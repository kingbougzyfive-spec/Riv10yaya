import { z } from "zod";
import mongoose from "mongoose";
import { handle, audit } from "@/lib/api";
import { ApiError, createSession, hashPassword } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { memberId, phoneKey, validPhone } from "@/lib/ids";
import { HOUR, MIN, rateLimit } from "@/lib/ratelimit";
import { isMinor } from "@/lib/members";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().refine(validPhone, "Enter a valid phone number"),
  email: z.string().trim().email(),
  password: z.string().min(10, "Use at least 10 characters").max(100),
  parish: z.string().optional().default("").refine((v) => v === "" || mongoose.isValidObjectId(v), "That parish isn't valid"),
  dob: z.string().refine((v) => !Number.isNaN(Date.parse(v)) && Date.parse(v) < Date.now(), "Enter your date of birth"),
  memberId: z.string().trim().max(20).optional().default(""),
  guardian: z.object({ name: z.string().trim().min(2).max(100), phone: z.string().trim().refine(validPhone, "Enter a valid guardian phone"), relationship: z.string().trim().min(2).max(40) }).optional(),
  guardianConsent: z.boolean().default(false),
  privacy: z.literal(true, { errorMap: () => ({ message: "Please agree to how your details are used." }) }),
});

/** Member self sign-up. Always creates a plain "member" account; admin roles can only be granted by the Super Admin. */
export const POST = handle(async (req) => {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  await rateLimit(`join:${ip}`, 5, 10 * MIN, "Too many attempts. Please try again later.");
  const i = schema.parse(await req.json());
  const { Member, Parish, User } = await getDb();
  // Parish is optional: someone can join first and be placed in a parish later by an administrator.
  const p = i.parish ? await Parish.findOne({ _id: i.parish, active: true }, { zone: 1, area: 1 }).lean<any>() : null;
  if (i.parish && !p) throw new ApiError(400, "That parish doesn't exist.");
  const key = phoneKey(i.phone);
  const email = i.email.toLowerCase();
  if (await User.exists({ email })) throw new ApiError(409, "An account with this email already exists. Try signing in.");
  // A phone may already belong to a member added by their parish admin: link to it instead of duplicating.
  let m = await Member.findOne({ phoneKey: key });
  if (m && (await User.exists({ phone: key, role: "member" }))) throw new ApiError(409, "This phone number already has an account.");
  // A phone number alone must never be enough to take over a record a parish created: it also carries personal details
  // (and sometimes a minor's). The member ID the parish gave them proves they are that person.
  if (m && i.memberId.toUpperCase() !== String(m.memberId).toUpperCase()) throw new ApiError(409, "This phone number is already on our records. Enter the member ID your parish gave you to link your account, or ask your parish administrator.");
  if (!m) {
    const minor = isMinor(i.dob);
    if (minor && (!i.guardian || !i.guardianConsent)) throw new ApiError(422, "If you are under 18, a parent or guardian's details and their consent are needed.");
    const now = new Date();
    m = await Member.create({
      memberId: memberId(), name: i.name, phone: i.phone, phoneKey: key, email, ...(p ? { zone: p.zone, area: p.area ?? null, parish: p._id } : {}), dob: new Date(i.dob),
      consent: { privacyAt: now, by: "self" },
      // Guardian consent is recorded as given, but stays unverified until the parish administrator confirms it.
      guardian: minor ? { ...i.guardian, consentAt: now } : undefined,
      changes: [{ at: now, byName: "Self sign-up", field: "record", from: "", to: "Registered", reason: "" }],
    });
  }
  const u = await User.create({ name: i.name, email, phone: key, role: "member", passwordHash: await hashPassword(i.password) });
  await createSession(String(u._id), "member");
  await audit({ id: String(u._id), name: u.name, email, role: "member" }, "member.join", m.memberId, undefined, req);
  return { ok: true, memberId: m.memberId };
});
