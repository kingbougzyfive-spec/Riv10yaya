/**
 * Works out WHO a message goes to, and refuses anyone outside the sender's responsibility.
 * People with accounts get in-app / push / email; members and registrants without accounts can only get email.
 * Under-18s are never emailed by a bulk send (they get in-app and push only), to protect their contact details.
 */
import mongoose from "mongoose";
import { ApiError, type SessionUser } from "./auth";
import { getDb } from "./db";
import { canView, isProvincialAdmin } from "./governance";
import { isMinor } from "./members";
import { keysOf } from "./member-store";
import type { External } from "./notifier";

export const AUDIENCE_TYPES = ["everyone", "zones", "areas", "parishes", "departments", "event", "members"] as const;
export type AudienceType = (typeof AUDIENCE_TYPES)[number];
export type AudienceSpec = { type: AudienceType; ids?: string[]; eventId?: string };
export const COMMS_ROLES = ["super_admin", "provincial_admin", "zonal_admin", "area_admin", "parish_admin", "event_admin"] as const;
export const MAX_RECIPIENTS = 5000;

export type Resolved = { userIds: string[]; external: External[]; noEmail: string[]; labels: string[]; stats: { total: number; accounts: number; emailOnly: number; minorsInAppOnly: number; unreachable: number }; capped: boolean };
const ok = (v: unknown) => typeof v === "string" && mongoose.isValidObjectId(v);
const sid = (v: any) => (v ? String(v) : "");

/** Member filter that limits to the sender's own part of the church. */
function memberScope(u: SessionUser): Record<string, unknown> | null {
  if (isProvincialAdmin(u.role)) return {};
  if (u.role === "zonal_admin" && u.zone) return { zone: u.zone };
  if (u.role === "area_admin" && u.area) return { area: u.area };
  if (u.role === "parish_admin" && u.parish) return { parish: u.parish };
  return null;
}

/** Turns member records into accounts (by phone) and email-only addresses. */
export async function fromMembers(members: any[]) {
  const { User } = await getDb();
  const minorsKeys = new Set<string>();
  const keyToMember = new Map<string, any>();
  for (const m of members) for (const k of keysOf(m)) { keyToMember.set(k, m); if (isMinor(m.dob)) minorsKeys.add(k); }
  const users = keyToMember.size ? await User.find({ role: "member", active: true, phone: { $in: [...keyToMember.keys()] } }, { _id: 1, phone: 1 }).lean<any[]>() : [];
  const withAccount = new Set(users.map((u) => keyToMember.get(u.phone)?._id && String(keyToMember.get(u.phone)._id)));
  const external: External[] = [];
  let minorsInAppOnly = 0, unreachable = 0;
  for (const m of members) {
    const has = withAccount.has(String(m._id));
    if (isMinor(m.dob)) { minorsInAppOnly++; if (!has) unreachable++; continue; }
    if (!has) { if (m.email) external.push({ email: m.email, name: m.name }); else unreachable++; }
  }
  return { userIds: users.map((u) => String(u._id)), noEmail: users.filter((u) => minorsKeys.has(u.phone)).map((u) => String(u._id)), external, minorsInAppOnly, unreachable, accounts: withAccount.size };
}

export async function resolveAudience(u: SessionUser, spec: AudienceSpec): Promise<Resolved> {
  if (!(COMMS_ROLES as readonly string[]).includes(u.role)) throw new ApiError(403, "You can't send messages.");
  const { User, Member, Zone, Area, Parish, Department, Registration, Event } = await getDb();
  const scope = memberScope(u);
  const ids = (spec.ids ?? []).filter(ok).slice(0, 200);
  const userIds = new Set<string>();
  const noEmail = new Set<string>();
  let external: External[] = [];
  let labels: string[] = [];
  let members: any[] = [];
  let accountsAdd = 0;

  const adminsBy = async (f: Record<string, unknown>) => (await User.find({ active: true, role: { $ne: "member" }, ...f }, { _id: 1 }).lean<any[]>()).map((x) => String(x._id));

  if (u.role === "event_admin" && spec.type !== "event") throw new ApiError(403, "You can message event registrants only.");
  if (spec.type === "everyone") {
    if (!isProvincialAdmin(u.role)) throw new ApiError(403, "Only provincial administrators can message everyone.");
    labels = ["Everyone"];
    (await User.find({ active: true }, { _id: 1 }).limit(MAX_RECIPIENTS).lean<any[]>()).forEach((x) => userIds.add(String(x._id)));
    members = await Member.find({ active: true }, { phoneKey: 1, oldPhoneKeys: 1, email: 1, name: 1, dob: 1 }).limit(MAX_RECIPIENTS).lean<any[]>();
  } else if (spec.type === "zones" || spec.type === "areas" || spec.type === "parishes") {
    if (!ids.length) throw new ApiError(422, "Choose at least one.");
    const model = spec.type === "zones" ? Zone : spec.type === "areas" ? Area : Parish;
    const docs = await model.find({ _id: { $in: ids } }).lean<any[]>();
    if (docs.length !== ids.length) throw new ApiError(404, "One of those places doesn't exist.");
    for (const d of docs) {
      const org = spec.type === "zones" ? { level: "zone" as const, zone: sid(d._id) } : spec.type === "areas" ? { level: "area" as const, zone: sid(d.zone), area: sid(d._id) } : { level: "parish" as const, zone: sid(d.zone), area: sid(d.area) || null, parish: sid(d._id) };
      if (!canView(u, org)) throw new ApiError(403, `${d.name} is outside your responsibility.`);
    }
    labels = docs.map((d) => d.name);
    const key = spec.type === "zones" ? "zone" : spec.type === "areas" ? "area" : "parish";
    members = await Member.find({ [key]: { $in: ids }, active: true }, { phoneKey: 1, oldPhoneKeys: 1, email: 1, name: 1, dob: 1 }).limit(MAX_RECIPIENTS).lean<any[]>();
    // Zone: also its own administrators. A zone message reaches the area and parish admins beneath it.
    (await adminsBy({ [key]: { $in: ids } })).forEach((x) => userIds.add(x));
    if (spec.type === "zones") (await adminsBy({ zone: { $in: ids } })).forEach((x) => userIds.add(x));
    if (spec.type === "areas") (await adminsBy({ area: { $in: ids } })).forEach((x) => userIds.add(x));
  } else if (spec.type === "departments") {
    if (!ids.length) throw new ApiError(422, "Choose at least one department.");
    if (!scope) throw new ApiError(403, "You can't send messages.");
    const deps = await Department.find({ _id: { $in: ids } }).lean<any[]>();
    if (deps.length !== ids.length) throw new ApiError(404, "One of those departments doesn't exist.");
    for (const d of deps) { const lv = d.level ?? "province"; if (lv !== "province" && !canView(u, { level: lv, zone: sid(d.zone), area: sid(d.area) || null, parish: sid(d.parish) || null })) throw new ApiError(403, `${d.name} is outside your responsibility.`); }
    labels = deps.map((d) => d.name);
    // Members of the department, limited to the sender's own part of the church.
    members = await Member.find({ departments: { $in: ids }, active: true, ...scope }, { phoneKey: 1, oldPhoneKeys: 1, email: 1, name: 1, dob: 1 }).limit(MAX_RECIPIENTS).lean<any[]>();
  } else if (spec.type === "members") {
    if (!scope) throw new ApiError(403, "You can't send messages.");
    if (!ids.length) throw new ApiError(422, "Choose at least one member.");
    // Anyone outside the sender's scope is silently not found, exactly like everywhere else.
    members = await Member.find({ _id: { $in: ids }, ...scope }, { phoneKey: 1, oldPhoneKeys: 1, email: 1, name: 1, dob: 1 }).lean<any[]>();
    if (members.length !== ids.length) throw new ApiError(404, "One of those members wasn't found.");
    labels = [`${members.length} selected member${members.length === 1 ? "" : "s"}`];
  } else if (spec.type === "event") {
    if (!ok(spec.eventId)) throw new ApiError(422, "Choose an event.");
    const ev = await Event.findById(spec.eventId, { title: 1 }).lean<any>();
    if (!ev) throw new ApiError(404, "Event not found.");
    const f: any = { event: spec.eventId, status: "registered" };
    if (!isProvincialAdmin(u.role) && u.role !== "event_admin") { if (!scope) throw new ApiError(403, "You can't send messages."); Object.assign(f, scope); }
    labels = [`Registered for ${ev.title}`];
    const r = await registrantRecipients(f);
    r.userIds.forEach((x) => userIds.add(x)); r.noEmail.forEach((x) => noEmail.add(x)); external = r.external;
    return finish(userIds, noEmail, external, labels, { ...r.stats });
  } else throw new ApiError(400, "Choose who to send to.");

  const m = await fromMembers(members);
  m.userIds.forEach((x) => userIds.add(x)); m.noEmail.forEach((x) => noEmail.add(x)); external = m.external; accountsAdd = m.accounts;
  return finish(userIds, noEmail, external, labels, { minorsInAppOnly: m.minorsInAppOnly, unreachable: m.unreachable, accounts: accountsAdd });
}

function finish(userIds: Set<string>, noEmail: Set<string>, external: External[], labels: string[], s: { minorsInAppOnly?: number; unreachable?: number; accounts?: number }): Resolved {
  const all = [...userIds];
  const capped = all.length + external.length > MAX_RECIPIENTS;
  const u = capped ? all.slice(0, MAX_RECIPIENTS) : all;
  const e = capped ? external.slice(0, Math.max(0, MAX_RECIPIENTS - u.length)) : external;
  return { userIds: u, noEmail: [...noEmail], external: e, labels, capped, stats: { total: u.length + e.length, accounts: u.length, emailOnly: e.length, minorsInAppOnly: s.minorsInAppOnly ?? 0, unreachable: s.unreachable ?? 0 } };
}

/** People registered for an event: accounts (via member link or phone) and email-only registrants. */
export async function registrantRecipients(filter: Record<string, unknown>) {
  const { Registration, User, Member } = await getDb();
  const regs = await Registration.find(filter, { phoneKey: 1, email: 1, name: 1, member: 1 }).limit(MAX_RECIPIENTS).lean<any[]>();
  const keys = [...new Set(regs.map((r) => r.phoneKey))];
  const users = keys.length ? await User.find({ role: "member", active: true, phone: { $in: keys } }, { _id: 1, phone: 1 }).lean<any[]>() : [];
  const have = new Set(users.map((x) => x.phone));
  const minorKeys = new Set<string>();
  const mids = regs.filter((r) => r.member).map((r) => r.member);
  if (mids.length) for (const m of await Member.find({ _id: { $in: mids } }, { dob: 1, phoneKey: 1 }).lean<any[]>()) if (isMinor(m.dob)) minorKeys.add(m.phoneKey);
  const external: External[] = [];
  let unreachable = 0, minorsInAppOnly = 0;
  const noEmail = users.filter((x) => minorKeys.has(x.phone)).map((x) => String(x._id));
  for (const r of regs) {
    if (minorKeys.has(r.phoneKey)) { minorsInAppOnly++; continue; }
    if (!have.has(r.phoneKey)) { if (r.email) external.push({ email: r.email, name: r.name }); else unreachable++; }
  }
  return { userIds: users.map((x) => String(x._id)), noEmail, external, stats: { minorsInAppOnly, unreachable, accounts: users.length }, regs };
}
