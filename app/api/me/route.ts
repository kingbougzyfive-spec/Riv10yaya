import { z } from "zod";
import { handle } from "@/lib/api";
import { ApiError, requireApiUser, verifyPassword } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { phoneKey, validPhone } from "@/lib/ids";
import { ageOn, isMinor } from "@/lib/members";
import { deptNames, historyOf } from "@/lib/member-store";
import { orgNames } from "@/lib/names";

export const dynamic = "force-dynamic";

/** A member's own data only. There is no id parameter anywhere, so no one else's record can even be requested. */
async function mine() {
  const user = await requireApiUser(["member"]);
  const { Member } = await getDb();
  const m = await Member.findOne({ $or: [{ phoneKey: phoneKey(user.phone ?? "") }, { oldPhoneKeys: phoneKey(user.phone ?? "") }] });
  if (!m) throw new ApiError(404, "We couldn't find your member record. Please contact your parish administrator.");
  return { user, m };
}

export const GET = handle(async () => {
  const { user, m } = await mine();
  const { User } = await getDb();
  const n = await orgNames();
  const [h, depts, u] = await Promise.all([historyOf(m), deptNames(m.departments ?? []), User.findById(user.id, { prefs: 1 }).lean<any>()]);
  const minor = isMinor(m.dob);
  return {
    // Pastoral follow-up and the change log are deliberately never part of what a member can see.
    profile: {
      memberId: m.memberId, name: m.name, phone: m.phone, email: m.email ?? user.email, gender: m.gender, category: m.category, status: m.status, joinedAt: m.joinedAt ?? m.createdAt,
      zone: n.zone.get(String(m.zone)), area: m.area ? n.area.get(String(m.area)) : "", parish: n.parish.get(String(m.parish)), departments: depts.map((d) => d.name),
      leadership: m.leadership?.title ? { title: m.leadership.title, level: m.leadership.level } : null,
      age: ageOn(m.dob), minor, guardian: minor && m.guardian ? { name: m.guardian.name, relationship: m.guardian.relationship, verified: !!m.guardian.verifiedAt } : null, dobMissing: !m.dob,
    },
    prefs: { email: u?.prefs?.email ?? true, sms: u?.prefs?.sms ?? true, push: u?.prefs?.push ?? true },
    attendance: h.attendance.map((a) => ({ id: a.id, title: a.title, at: a.at })),
    events: h.events.map((e) => ({ id: e.id, eventId: e.eventId, reference: e.reference, title: e.title, startsAt: e.startsAt, venue: e.venue, attended: e.attended })),
    volunteer: (m.volunteer ?? []).map((v: any) => ({ id: String(v._id), title: v.title, at: v.at, hours: v.hours })).reverse(),
  };
});

const patch = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  email: z.string().trim().email().optional(),
  phone: z.string().trim().refine(validPhone, "Enter a valid phone number").optional(),
  currentPassword: z.string().max(100).optional(),
  prefs: z.object({ email: z.boolean(), sms: z.boolean(), push: z.boolean() }).partial().optional(),
});

/** Only name, email, phone and notification preferences are member-editable. Parish, category, status and leadership are administrative. */
export const PATCH = handle(async (req) => {
  const { user, m } = await mine();
  const i = patch.parse(await req.json());
  const { User } = await getDb();
  const now = new Date();
  const log = (field: string, from: string, to: string) => m.changes.push({ at: now, by: user.id, byName: `${user.name} (self)`, field, from, to, reason: "Member updated own profile" });
  const set: any = {};
  if (i.name && i.name !== m.name) { log("name", m.name, i.name); m.name = i.name; set.name = i.name; }
  if (i.email && i.email.toLowerCase() !== (m.email ?? "").toLowerCase()) {
    if (await User.exists({ email: i.email.toLowerCase(), _id: { $ne: user.id } })) throw new ApiError(409, "That email is already used by another account.");
    log("email", m.email ?? "", i.email); m.email = i.email; set.email = i.email.toLowerCase();
  }
  if (i.phone && phoneKey(i.phone) !== m.phoneKey) {
    // The phone number is how a person is recognised, so changing it needs the password.
    const u = await User.findById(user.id).lean<any>();
    if (!i.currentPassword || !u || !(await verifyPassword(i.currentPassword, u.passwordHash))) throw new ApiError(403, "Enter your current password to change your phone number.");
    const key = phoneKey(i.phone);
    if ((await User.exists({ phone: key, _id: { $ne: user.id } })) || (await (await getDb()).Member.exists({ phoneKey: key, _id: { $ne: m._id } }))) throw new ApiError(409, "That phone number is already in use.");
    log("phone", m.phone, i.phone);
    m.oldPhoneKeys = [...new Set([...(m.oldPhoneKeys ?? []), m.phoneKey])]; m.phone = i.phone; m.phoneKey = key; set.phone = key;
  }
  if (i.prefs) for (const k of ["email", "sms", "push"] as const) if (i.prefs[k] !== undefined) set[`prefs.${k}`] = i.prefs[k];
  if (Object.keys(set).length) await User.updateOne({ _id: user.id }, { $set: set });
  await m.save();
  return { ok: true };
});
