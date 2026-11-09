import mongoose from "mongoose";
import { getDb } from "./db";
import { canSeeMinor, shapeMember } from "./members";
import { deptNames } from "./member-store";
import { orgNames } from "./names";
import { clampScope } from "./scope";

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const eighteenAgo = () => { const d = new Date(); d.setFullYear(d.getFullYear() - 18); return d; };

export async function listMembers(q: URLSearchParams, user: any, scope: any, limit: number) {
  const f: any = clampScope(scope, q);
  if (q.get("status")) f.status = q.get("status");
  if (q.get("category")) f.category = q.get("category");
  if (q.get("department") && mongoose.isValidObjectId(q.get("department"))) f.departments = q.get("department");
  if (q.get("leaders") === "1") f["leadership.title"] = { $exists: true, $ne: "" };
  const and: any[] = [];
  if (q.get("minor") === "1") and.push({ dob: { $gt: eighteenAgo() } });
  if (q.get("minor") === "0") and.push({ $or: [{ dob: null }, { dob: { $exists: false } }, { dob: { $lte: eighteenAgo() } }] });
  const s = q.get("q")?.trim();
  if (s) {
    const rx = new RegExp(esc(s), "i");
    // A minor's phone or email can't be discovered by searching unless the viewer may see it.
    const open = canSeeMinor(user.role) ? [{ phone: rx }, { email: rx }] : [{ $and: [{ $or: [{ phone: rx }, { email: rx }] }, { $or: [{ dob: null }, { dob: { $exists: false } }, { dob: { $lte: eighteenAgo() } }] }] }];
    and.push({ $or: [{ name: rx }, { memberId: rx }, ...open] });
  }
  if (and.length) f.$and = and;
  const { Member } = await getDb();
  const page = Math.max(1, Number(q.get("page")) || 1);
  const [rows, total, n] = await Promise.all([Member.find(f).sort({ createdAt: -1 }).skip(limit > 1000 ? 0 : (page - 1) * limit).limit(limit).lean<any[]>(), Member.countDocuments(f), orgNames()]);
  const depts = new Map<string, string>();
  const dids = [...new Set(rows.flatMap((m) => (m.departments ?? []).map(String)))];
  (await deptNames(dids)).forEach((d) => depts.set(d.id, d.name));
  const out = rows.map((m) => shapeMember({
    id: String(m._id), memberId: m.memberId, name: m.name, phone: m.phone, email: m.email, dob: m.dob, gender: m.gender, guardian: m.guardian, category: m.category, status: m.status, joinedAt: m.joinedAt ?? m.createdAt,
    parishId: String(m.parish), parish: n.parish.get(String(m.parish)), area: m.area ? n.area.get(String(m.area)) : "", zone: n.zone.get(String(m.zone)),
    departments: (m.departments ?? []).map((d: any) => depts.get(String(d))).filter(Boolean), leadership: m.leadership,
  }, user.role));
  return { rows: out, total, page, pages: Math.ceil(total / limit) };
}

