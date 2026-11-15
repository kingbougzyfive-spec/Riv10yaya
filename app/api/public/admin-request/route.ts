import mongoose from "mongoose";
import { z } from "zod";
import { audit, handle } from "@/lib/api";
import { ApiError, hashPassword } from "@/lib/auth";
import { chainFor } from "@/lib/admin-request";
import { getDb } from "@/lib/db";
import { notifyUsers } from "@/lib/notify";
import { passwordField, passwordProblem } from "@/lib/password";
import { HOUR, clientIp, rateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";
const schema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(80),
  email: z.string().trim().email("Enter a valid email").max(120),
  phone: z.string().trim().regex(/^(\+?\d[\d\s-]{7,16})$/, "Enter a valid phone number"),
  password: passwordField,
  level: z.enum(["zone", "area", "parish"]),
  /** The one thing they pick: a zone, an area or a parish, matching the level. Optional. */
  unit: z.string().optional().default("").refine((v) => v === "" || mongoose.isValidObjectId(v), "Invalid choice"),
});

/** Public: a zone, area or parish administrator asks for an account. They must pick their zone, area and parish from the lists the Super Administrator maintains. Nothing is created until it is approved. */
export const POST = handle(async (req) => {
  const i = schema.parse(await req.json());
  await rateLimit(`adminreq:${clientIp(req)}`, 10, HOUR, "Too many requests from this device. Please try again later.");
  const email = i.email.toLowerCase();
  const pw = passwordProblem(i.password, { email, name: i.name });
  if (pw) throw new ApiError(422, pw);

  const { User, AdminRequest } = await getDb();
  // Picking is optional. If they picked, it must be a real one; if not, the Super Administrator assigns it when approving.
  const chain = await chainFor(i.level, i.unit);
  if (i.unit && !chain) throw new ApiError(400, `Please choose your ${i.level} from the list.`);
  const unitName: string = chain?.unit.name ?? "";

  if (await User.exists({ email })) throw new ApiError(409, "That email already has an account. Please sign in instead.");
  if (await AdminRequest.exists({ email, status: "pending" })) throw new ApiError(409, "You've already sent a request with that email. It is waiting for approval.");

  const r = await AdminRequest.create({
    name: i.name, email, phone: i.phone, passwordHash: await hashPassword(i.password), level: i.level,
    zone: chain?.zone._id, area: chain?.area?._id, parish: chain?.parish?._id,
    zoneName: chain?.zone.name, areaName: chain?.area?.name, parishName: chain?.parish?.name, orgName: unitName,
  });
  await audit(null, "adminrequest.create", email, { entity: "adminrequest", entityId: String(r._id), after: { level: i.level, organisation: unitName || "not chosen" } }, req);
  const supers = (await User.find({ role: "super_admin", active: true }, { _id: 1 }).lean<any[]>()).map((u) => String(u._id));
  await notifyUsers(supers, { title: "New administrator registration", body: `${i.name} asked for a ${i.level} administrator account${unitName ? ` for ${unitName}` : " (they did not choose one: please assign it when you approve)"}.`, link: "/admin/requests" });
  return { ok: true };
});
