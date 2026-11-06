import { z } from "zod";
import mongoose from "mongoose";
import { handle, audit } from "@/lib/api";
import { ApiError, requireApiUser, type SessionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { phoneKey, validPhone } from "@/lib/ids";
import { canFollowUp, canSeeMinor, diffTracked, FOLLOW_KINDS, isMinor, MEMBER_STATUSES, shapeMember, statusActive } from "@/lib/members";
import { deptNames, getCategories, historyOf } from "@/lib/member-store";
import { inScope, orgNames } from "@/lib/names";
import { PERMS } from "@/lib/rbac";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** Loads a member only if it sits inside the caller's zone/area/parish. Out-of-scope ids look exactly like missing ones. */
async function load(user: SessionUser, id: string) {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(404, "Member not found.");
  const { Member } = await getDb();
  const m = await Member.findById(id);
  if (!m || !(await inScope(user, { zone: m.zone, area: m.area, parish: m.parish }))) throw new ApiError(404, "Member not found.");
  return m;
}

export const GET = handle<Ctx>(async (req, ctx) => {
  const user = await requireApiUser(PERMS.members);
  const m = await load(user, (await ctx.params).id);
  const n = await orgNames();
  const depts = await deptNames(m.departments ?? []);
  const shaped: any = shapeMember({
    id: String(m._id), memberId: m.memberId, name: m.name, phone: m.phone, email: m.email, dob: m.dob, gender: m.gender, guardian: m.guardian, category: m.category, status: m.status, joinedAt: m.joinedAt ?? m.createdAt,
    parishId: String(m.parish), parish: n.parish.get(String(m.parish)), area: m.area ? n.area.get(String(m.area)) : "", zone: n.zone.get(String(m.zone)), departments: depts.map((d) => d.name), leadership: m.leadership,
  }, user.role);
  shaped.departmentIds = depts.map((d) => d.id);
  // Under-18 records are only opened in full by the parish administrator (or the super admin); each opening is logged.
  if (shaped.restricted) return { member: shaped, history: null, volunteer: [], followUps: null, changes: [], canFollowUp: false };
  if (shaped.minor) await audit(user, "member.view_minor", m.memberId, undefined, req);
  const history = await historyOf(m);
  const fu = canFollowUp(user.role);
  return {
    member: shaped, history, canFollowUp: fu,
    volunteer: (m.volunteer ?? []).map((v: any) => ({ id: String(v._id), title: v.title, at: v.at, hours: v.hours, note: v.note, byName: v.byName })).reverse(),
    followUps: fu ? (m.followUps ?? []).map((f: any) => ({ id: String(f._id), kind: f.kind, note: f.note, outcome: f.outcome, nextAt: f.nextAt, done: f.done, at: f.at, byName: f.byName })).reverse() : null,
    changes: (m.changes ?? []).map((c: any) => ({ at: c.at, byName: c.byName, field: c.field, from: c.from, to: c.to, reason: c.reason })).reverse(),
  };
});

const dateStr = z.string().refine((v) => !Number.isNaN(Date.parse(v)), "Enter a valid date");
const body = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("update"),
    name: z.string().trim().min(2).max(100).optional(),
    phone: z.string().trim().refine(validPhone, "Enter a valid phone number").optional(),
    email: z.string().trim().email().or(z.literal("")).optional(),
    dob: dateStr.optional(), gender: z.enum(["male", "female", ""]).optional(),
    category: z.string().trim().min(2).max(40).optional(),
    status: z.enum(MEMBER_STATUSES).optional(),
    joinedAt: dateStr.optional(),
    parish: z.string().optional(),
    departments: z.array(z.string()).max(10).optional(),
    leadership: z.object({ title: z.string().trim().max(80), level: z.enum(["parish", "area", "zone", "province", ""]) }).optional(),
    guardian: z.object({ name: z.string().trim().min(2).max(100), phone: z.string().trim().refine(validPhone, "Enter a valid guardian phone"), relationship: z.string().trim().min(2).max(40) }).optional(),
    verifyGuardian: z.boolean().optional(),
    reason: z.string().trim().max(300).optional().default(""),
  }),
  z.object({ action: z.literal("followup_add"), kind: z.enum(FOLLOW_KINDS).default("call"), note: z.string().trim().min(2).max(1000), outcome: z.string().trim().max(500).optional().default(""), nextAt: dateStr.optional() }),
  z.object({ action: z.literal("followup_done"), followUpId: z.string(), outcome: z.string().trim().max(500).optional().default("") }),
  z.object({ action: z.literal("volunteer_add"), title: z.string().trim().min(2).max(120), at: dateStr.optional(), hours: z.number().min(0).max(1000).optional(), note: z.string().trim().max(500).optional().default("") }),
]);

export const PATCH = handle<Ctx>(async (req, ctx) => {
  const user = await requireApiUser(PERMS.members);
  const m = await load(user, (await ctx.params).id);
  const i = body.parse(await req.json());
  const minor = isMinor(m.dob);
  // A minor's record can only be opened or changed by the roles allowed to see it.
  if (minor && !canSeeMinor(user.role)) throw new ApiError(403, "Members under 18 are managed by their Parish Administrator.");
  const now = new Date();

  if (i.action === "followup_add" || i.action === "followup_done") {
    if (!canFollowUp(user.role)) throw new ApiError(403, "You can't record follow-up.");
    if (i.action === "followup_add") m.followUps.push({ kind: i.kind, note: i.note, outcome: i.outcome, nextAt: i.nextAt ? new Date(i.nextAt) : undefined, done: false, at: now, by: user.id, byName: user.name });
    else { const f = m.followUps.id(i.followUpId); if (!f) throw new ApiError(404, "Follow-up not found."); f.done = true; if (i.outcome) f.outcome = i.outcome; }
    await m.save();
    await audit(user, `member.${i.action}`, m.memberId, undefined, req);
    return { ok: true };
  }
  if (i.action === "volunteer_add") {
    m.volunteer.push({ title: i.title, at: i.at ? new Date(i.at) : now, hours: i.hours, note: i.note, byName: user.name });
    await m.save();
    await audit(user, "member.volunteer", m.memberId, { title: i.title }, req);
    return { ok: true };
  }

  // ---- update ----
  const before: Record<string, unknown> = { name: m.name, phone: m.phone, email: m.email, dob: m.dob, gender: m.gender, category: m.category, status: m.status, joinedAt: m.joinedAt, leadership: m.leadership?.title ? { title: m.leadership.title, level: m.leadership.level } : null, departments: (m.departments ?? []).map(String).sort(), guardian: m.guardian ? { name: m.guardian.name, phone: m.guardian.phone, relationship: m.guardian.relationship } : null, parish: String(m.parish), area: m.area ? String(m.area) : "", zone: String(m.zone) };
  const after: Record<string, unknown> = {};
  if (i.name !== undefined) { m.name = i.name; after.name = i.name; }
  if (i.phone !== undefined && phoneKey(i.phone) !== m.phoneKey) {
    const key = phoneKey(i.phone);
    if (await (await getDb()).Member.exists({ phoneKey: key, _id: { $ne: m._id } })) throw new ApiError(409, "Another member already uses this phone number.");
    // Keep the old key so earlier attendance and registrations stay attached to this person.
    m.oldPhoneKeys = [...new Set([...(m.oldPhoneKeys ?? []), m.phoneKey])];
    m.phone = i.phone; m.phoneKey = key; after.phone = i.phone;
    await (await getDb()).User.updateOne({ role: "member", phone: before.phone ? phoneKey(String(before.phone)) : "" }, { $set: { phone: key } });
  }
  if (i.email !== undefined) { m.email = i.email || undefined; after.email = i.email; }
  if (i.dob !== undefined) { if (Date.parse(i.dob) > Date.now()) throw new ApiError(422, "Date of birth can't be in the future"); m.dob = new Date(i.dob); after.dob = m.dob; }
  if (i.gender !== undefined) { m.gender = i.gender; after.gender = i.gender; }
  if (i.joinedAt !== undefined) { m.joinedAt = new Date(i.joinedAt); after.joinedAt = m.joinedAt; }
  if (i.category !== undefined) { if (!(await getCategories()).some((c) => c.label === i.category && (c.active || c.label === m.category))) throw new ApiError(422, "Choose a listed category."); m.category = i.category; after.category = i.category; }
  if (i.status !== undefined) { m.status = i.status; m.active = statusActive(i.status); after.status = i.status; }
  if (i.departments !== undefined) { m.departments = i.departments.filter((d) => mongoose.isValidObjectId(d)); after.departments = [...m.departments].map(String).sort(); }
  if (i.leadership !== undefined) { m.leadership = i.leadership.title ? { title: i.leadership.title, level: i.leadership.level, since: m.leadership?.since ?? now } : { title: "", level: "" }; after.leadership = i.leadership.title ? { title: i.leadership.title, level: i.leadership.level } : null; }
  if (i.parish !== undefined && i.parish !== String(m.parish)) {
    if (!mongoose.isValidObjectId(i.parish)) throw new ApiError(400, "Choose a parish.");
    const p = await (await getDb()).Parish.findById(i.parish, { zone: 1, area: 1 }).lean<any>();
    if (!p) throw new ApiError(400, "That parish doesn't exist.");
    // Both ends of a transfer must be inside the caller's responsibility.
    if (!(await inScope(user, { zone: p.zone, area: p.area, parish: p._id }))) throw new ApiError(403, "That parish is outside your responsibility.");
    // Zone, area and parish always move together, so a record can never point at a mixed-up hierarchy.
    m.parish = p._id; m.area = p.area ?? null; m.zone = p.zone;
    after.parish = String(p._id); after.area = p.area ? String(p.area) : ""; after.zone = String(p.zone);
  }
  if (i.guardian !== undefined) { m.guardian = { ...(m.guardian?.toObject?.() ?? {}), ...i.guardian, consentAt: m.guardian?.consentAt ?? now }; after.guardian = i.guardian; }
  if (i.verifyGuardian) {
    if (!isMinor(m.dob)) throw new ApiError(422, "Only members under 18 need a guardian check.");
    if (!m.guardian?.name || !m.guardian?.phone) throw new ApiError(422, "Add the parent or guardian's details first.");
    m.guardian.verifiedAt = now; m.guardian.verifiedByName = user.name; m.guardian.consentAt = m.guardian.consentAt ?? now;
    m.changes.push({ at: now, by: user.id, byName: user.name, field: "guardian verified", from: "", to: "Verified", reason: i.reason });
  }
  if (isMinor(m.dob) && !canSeeMinor(user.role)) throw new ApiError(403, "Members under 18 are managed by their Parish Administrator.");
  // A member who is now under 18 must have guardian details and consent.
  if (isMinor(m.dob) && (!m.guardian?.name || !m.guardian?.consentAt)) throw new ApiError(422, "A member under 18 needs a parent or guardian's details and consent.");

  const diffs = diffTracked(before, after);
  for (const d of diffs) m.changes.push({ at: now, by: user.id, byName: user.name, field: d.field, from: d.from, to: d.to, reason: i.reason });
  await m.save();
  await audit(user, "member.update", m.memberId, { fields: diffs.map((d) => d.field) }, req);
  return { ok: true, changed: diffs.map((d) => d.field) };
});
