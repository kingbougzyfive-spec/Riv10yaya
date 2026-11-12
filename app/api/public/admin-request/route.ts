import mongoose from "mongoose";
import { z } from "zod";
import { audit, handle } from "@/lib/api";
import { ApiError, hashPassword } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { notifyUsers } from "@/lib/notify";
import { passwordField, passwordProblem } from "@/lib/password";
import { HOUR, clientIp, rateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";
const oid = z.string().refine((v) => mongoose.isValidObjectId(v), "Invalid choice").optional().or(z.literal(""));
const schema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(80),
  email: z.string().trim().email("Enter a valid email").max(120),
  phone: z.string().trim().regex(/^(\+?\d[\d\s-]{7,16})$/, "Enter a valid phone number"),
  password: passwordField,
  level: z.enum(["zone", "area", "parish"]),
  zone: oid, area: oid, parish: oid,
  orgName: z.string().trim().max(80).optional().default(""),
});

const LEVEL_LABEL = { zone: "zone", area: "area", parish: "parish" } as const;

/** Public: a zone, area or parish administrator asks for an account. Nothing is created until the Super Administrator approves. */
export const POST = handle(async (req) => {
  const i = schema.parse(await req.json());
  await rateLimit(`adminreq:${clientIp(req)}`, 5, HOUR, "Too many requests from this device. Please try again later.");
  const email = i.email.toLowerCase();
  const pw = passwordProblem(i.password, { email, name: i.name });
  if (pw) throw new ApiError(422, pw);

  const { Zone, Area, Parish, User, AdminRequest } = await getDb();
  const zoneId = i.zone || undefined, areaId = i.area || undefined, parishId = i.parish || undefined;
  const typed = i.orgName.trim();
  const zone: any = zoneId ? await Zone.findOne({ _id: zoneId, active: true }).lean() : null;
  if (zoneId && !zone) throw new ApiError(400, "That zone doesn't exist.");
  let shownName = typed;

  if (i.level === "zone") {
    if (!zone && typed.length < 2) throw new ApiError(400, "Choose your zone, or type its name if it isn't listed.");
    if (zone) shownName = zone.name;
  } else {
    if (!zone) throw new ApiError(400, "Choose your zone first.");
    if (i.level === "area") {
      if (!zone.hasAreas) throw new ApiError(400, `"${zone.name}" has no areas. It works with parishes directly.`);
      const area: any = areaId ? await Area.findOne({ _id: areaId, zone: zoneId, active: true }).lean() : null;
      if (areaId && !area) throw new ApiError(400, "That area isn't in the selected zone.");
      if (!area && typed.length < 2) throw new ApiError(400, "Choose your area, or type its name if it isn't listed.");
      if (area) shownName = area.name;
    } else {
      if (zone.hasAreas) {
        const a: any = areaId ? await Area.findOne({ _id: areaId, zone: zoneId, active: true }).lean() : null;
        if (!a) throw new ApiError(400, "Choose the area your parish belongs to. If it isn't listed, ask your area leader to register first.");
      } else if (areaId) throw new ApiError(400, `"${zone.name}" has no areas.`);
      const parish: any = parishId ? await Parish.findOne({ _id: parishId, zone: zoneId, area: zone.hasAreas ? areaId : null, active: true }).lean() : null;
      if (parishId && !parish) throw new ApiError(400, "That parish isn't in the selected zone or area.");
      if (!parish && typed.length < 2) throw new ApiError(400, "Choose your parish, or type its name if it isn't listed.");
      if (parish) shownName = parish.name;
    }
  }

  if (await User.exists({ email })) throw new ApiError(409, "That email already has an account. Please sign in instead.");
  if (await AdminRequest.exists({ email, status: "pending" })) throw new ApiError(409, "You've already sent a request with that email. It is waiting for approval.");

  const r = await AdminRequest.create({
    name: i.name, email, phone: i.phone, passwordHash: await hashPassword(i.password), level: i.level,
    zone: zoneId, area: i.level === "zone" ? undefined : areaId || undefined, parish: i.level === "parish" ? parishId || undefined : undefined,
    orgName: shownName,
  });
  await audit(null, "adminrequest.create", email, { entity: "adminrequest", entityId: String(r._id), after: { level: i.level, organisation: shownName } }, req);
  const supers = (await User.find({ role: "super_admin", active: true }, { _id: 1 }).lean<any[]>()).map((u) => String(u._id));
  await notifyUsers(supers, { title: "New administrator registration", body: `${i.name} asked for a ${LEVEL_LABEL[i.level]} administrator account for ${shownName}.`, link: "/admin/requests" });
  return { ok: true };
});
