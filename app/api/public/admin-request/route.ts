import { z } from "zod";
import { audit, handle } from "@/lib/api";
import { ApiError, hashPassword } from "@/lib/auth";
import { matchTyped } from "@/lib/admin-request";
import { getDb } from "@/lib/db";
import { notifyUsers } from "@/lib/notify";
import { passwordField, passwordProblem } from "@/lib/password";
import { HOUR, clientIp, rateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";
const nameField = z.string().trim().max(80).optional().default("");
const schema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(80),
  email: z.string().trim().email("Enter a valid email").max(120),
  phone: z.string().trim().regex(/^(\+?\d[\d\s-]{7,16})$/, "Enter a valid phone number"),
  password: passwordField,
  level: z.enum(["zone", "area", "parish"]),
  zoneName: nameField, areaName: nameField, parishName: nameField,
});

/** Public: a zone, area or parish administrator asks for an account, typing their own zone, area and parish names. Nothing is created until the Super Administrator approves. */
export const POST = handle(async (req) => {
  const i = schema.parse(await req.json());
  await rateLimit(`adminreq:${clientIp(req)}`, 10, HOUR, "Too many requests from this device. Please try again later.");
  const email = i.email.toLowerCase();
  const pw = passwordProblem(i.password, { email, name: i.name });
  if (pw) throw new ApiError(422, pw);

  const need = (v: string, label: string) => { if (v.length < 2) throw new ApiError(400, `Type the name of your ${label}.`); };
  need(i.zoneName, "zone");
  if (i.level === "area") need(i.areaName, "area");
  if (i.level === "parish") need(i.parishName, "parish");

  // If they typed a zone we already know, check the rest makes sense for that zone.
  const m = await matchTyped({ level: i.level, zoneName: i.zoneName });
  let areaName = i.level === "zone" ? "" : i.areaName;
  if (m.zone) {
    if (i.level === "area" && !m.zone.hasAreas) throw new ApiError(400, `"${m.zone.name}" works with parishes directly and has no areas. Choose Parish instead.`);
    if (i.level === "parish" && m.zone.hasAreas) need(areaName, "area (this zone has areas)");
    if (i.level === "parish" && !m.zone.hasAreas) areaName = "";
  }
  const orgName = i.level === "zone" ? i.zoneName : i.level === "area" ? i.areaName : i.parishName;

  const { User, AdminRequest } = await getDb();
  if (await User.exists({ email })) throw new ApiError(409, "That email already has an account. Please sign in instead.");
  if (await AdminRequest.exists({ email, status: "pending" })) throw new ApiError(409, "You've already sent a request with that email. It is waiting for approval.");

  const r = await AdminRequest.create({
    name: i.name, email, phone: i.phone, passwordHash: await hashPassword(i.password), level: i.level,
    zoneName: i.zoneName, areaName: areaName || undefined, parishName: i.level === "parish" ? i.parishName : undefined, orgName,
  });
  await audit(null, "adminrequest.create", email, { entity: "adminrequest", entityId: String(r._id), after: { level: i.level, organisation: orgName } }, req);
  const supers = (await User.find({ role: "super_admin", active: true }, { _id: 1 }).lean<any[]>()).map((u) => String(u._id));
  await notifyUsers(supers, { title: "New administrator registration", body: `${i.name} asked for a ${i.level} administrator account for ${orgName}.`, link: "/admin/requests" });
  return { ok: true };
});
