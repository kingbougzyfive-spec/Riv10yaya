import mongoose from "mongoose";
import { z } from "zod";
import { audit, handle } from "@/lib/api";
import { ApiError, hashPassword } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { notifyUsers } from "@/lib/notify";
import { passwordField, passwordProblem } from "@/lib/password";
import { HOUR, clientIp, rateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";
const oid = z.string().refine((v) => v === "" || mongoose.isValidObjectId(v), "Invalid choice").optional().default("");
const schema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(80),
  email: z.string().trim().email("Enter a valid email").max(120),
  phone: z.string().trim().regex(/^(\+?\d[\d\s-]{7,16})$/, "Enter a valid phone number"),
  password: passwordField,
  level: z.enum(["zone", "area", "parish"]),
  zone: oid, area: oid, parish: oid,
});

/** Public: a zone, area or parish administrator asks for an account. They must pick their zone, area and parish from the lists the Super Administrator maintains. Nothing is created until it is approved. */
export const POST = handle(async (req) => {
  const i = schema.parse(await req.json());
  await rateLimit(`adminreq:${clientIp(req)}`, 10, HOUR, "Too many requests from this device. Please try again later.");
  const email = i.email.toLowerCase();
  const pw = passwordProblem(i.password, { email, name: i.name });
  if (pw) throw new ApiError(422, pw);

  const { Zone, Area, Parish, User, AdminRequest } = await getDb();
  const zone: any = i.zone ? await Zone.findOne({ _id: i.zone, active: true }).lean() : null;
  if (!zone) throw new ApiError(400, "Please select your zone from the list.");
  let area: any = null, parish: any = null;
  if (i.level === "area" || (i.level === "parish" && zone.hasAreas)) {
    if (!zone.hasAreas) throw new ApiError(400, `"${zone.name}" has no areas.`);
    area = i.area ? await Area.findOne({ _id: i.area, zone: zone._id, active: true }).lean() : null;
    if (!area) throw new ApiError(400, "Please select your area from the list.");
  }
  if (i.level === "parish") {
    parish = i.parish ? await Parish.findOne({ _id: i.parish, zone: zone._id, area: zone.hasAreas ? area._id : null, active: true }).lean() : null;
    if (!parish) throw new ApiError(400, "Please select your parish from the list.");
  }
  const unit = i.level === "zone" ? zone : i.level === "area" ? area : parish;

  if (await User.exists({ email })) throw new ApiError(409, "That email already has an account. Please sign in instead.");
  if (await AdminRequest.exists({ email, status: "pending" })) throw new ApiError(409, "You've already sent a request with that email. It is waiting for approval.");

  const r = await AdminRequest.create({
    name: i.name, email, phone: i.phone, passwordHash: await hashPassword(i.password), level: i.level,
    zone: zone._id, area: area?._id, parish: parish?._id,
    zoneName: zone.name, areaName: area?.name, parishName: parish?.name, orgName: unit.name,
  });
  await audit(null, "adminrequest.create", email, { entity: "adminrequest", entityId: String(r._id), after: { level: i.level, organisation: unit.name } }, req);
  const supers = (await User.find({ role: "super_admin", active: true }, { _id: 1 }).lean<any[]>()).map((u) => String(u._id));
  await notifyUsers(supers, { title: "New administrator registration", body: `${i.name} asked for a ${i.level} administrator account for ${unit.name}.`, link: "/admin/requests" });
  return { ok: true };
});
