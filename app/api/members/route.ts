import { z } from "zod";
import mongoose from "mongoose";
import { handle, audit } from "@/lib/api";
import { ApiError, requireApiUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { asFormat, tableResponse } from "@/lib/export";
import { memberId, phoneKey, validPhone } from "@/lib/ids";
import { canSeeMinor, isMinor, MEMBER_STATUSES, shapeMember, statusActive } from "@/lib/members";
import { deptNames, getCategories } from "@/lib/member-store";
import { inScope, orgNames } from "@/lib/names";
import { PERMS } from "@/lib/rbac";
import { recordScope } from "@/lib/scope";

export const dynamic = "force-dynamic";
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const eighteenAgo = () => { const d = new Date(); d.setFullYear(d.getFullYear() - 18); return d; };

export async function listMembers(req: Request, user: any, scope: any, limit: number) {
  const q = new URL(req.url).searchParams;
  const f: any = { ...scope };
  for (const k of ["zone", "area", "parish"]) if (q.get(k) && mongoose.isValidObjectId(q.get(k))) f[k] = q.get(k);
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

export const GET = handle(async (req) => {
  const user = await requireApiUser(PERMS.members);
  const scope = await recordScope(user);
  if (scope === null) throw new ApiError(403, "No access.");
  const fmt = new URL(req.url).searchParams.get("format");
  if (!fmt) { const r = await listMembers(req, user, scope, 50); return { ...r, categories: (await getCategories()).filter((c) => c.active) }; }
  const r = await listMembers(req, user, scope, 5000);
  await audit(user, "member.export", `${r.rows.length} members`, { filters: Object.fromEntries(new URL(req.url).searchParams) }, req);
  return tableResponse(asFormat(fmt), {
    name: `members-${new Date().toISOString().slice(0, 10)}`, title: "Members",
    head: ["Member ID", "Name", "Phone", "Email", "Zone", "Area", "Parish", "Category", "Status", "Date joined", "Departments", "Leadership"],
    rows: r.rows.map((m: any) => [m.memberId, m.name, m.restricted ? "(protected)" : m.phone, m.restricted ? "(protected)" : m.email ?? "", m.zone, m.area, m.parish, m.category, m.status, m.joinedAt ? new Date(m.joinedAt).toISOString().slice(0, 10) : "", (m.departments ?? []).join("; "), m.leadership?.title ?? ""]),
    pdfOmit: ["Email"],
  });
});

const dateStr = z.string().refine((v) => !Number.isNaN(Date.parse(v)), "Enter a valid date");
export const createSchema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().refine(validPhone, "Enter a valid phone number"),
  email: z.string().trim().email().optional().or(z.literal("")),
  parish: z.string().optional(),
  dob: dateStr.refine((v) => Date.parse(v) < Date.now(), "Date of birth can't be in the future"),
  gender: z.enum(["male", "female", ""]).default(""),
  category: z.string().trim().min(2).max(40).optional(),
  status: z.enum(MEMBER_STATUSES).default("active"),
  joinedAt: dateStr.optional(),
  departments: z.array(z.string()).max(10).default([]),
  leadership: z.object({ title: z.string().trim().max(80), level: z.enum(["parish", "area", "zone", "province"]) }).optional(),
  guardian: z.object({ name: z.string().trim().min(2).max(100), phone: z.string().trim().refine(validPhone, "Enter a valid guardian phone"), relationship: z.string().trim().min(2).max(40) }).optional(),
  guardianConsent: z.boolean().default(false),
  privacyNotice: z.literal(true, { errorMap: () => ({ message: "Confirm the member has been told how their details are used." }) }),
});

export const POST = handle(async (req) => {
  const user = await requireApiUser(PERMS.members);
  const i = createSchema.parse(await req.json());
  const parishId = user.role === "parish_admin" ? user.parish : i.parish;
  if (!parishId || !mongoose.isValidObjectId(parishId)) throw new ApiError(400, "Choose the member's parish.");
  const { Member, Parish } = await getDb();
  const p = await Parish.findById(parishId, { zone: 1, area: 1 }).lean<any>();
  if (!p) throw new ApiError(400, "That parish doesn't exist.");
  if (!(await inScope(user, { zone: p.zone, area: p.area, parish: p._id }))) throw new ApiError(403, "That parish is outside your responsibility.");
  const minor = isMinor(i.dob);
  if (minor) {
    if (!canSeeMinor(user.role)) throw new ApiError(403, "Members under 18 are registered by their Parish Administrator.");
    if (!i.guardian || !i.guardianConsent) throw new ApiError(422, "A member under 18 needs a parent or guardian's details and their consent.");
  }
  const cats = await getCategories();
  const category = i.category ?? cats.find((c) => c.active)?.label ?? "Youth";
  if (!cats.some((c) => c.active && c.label === category)) throw new ApiError(422, "Choose a listed category.");
  const key = phoneKey(i.phone);
  if (await Member.exists({ phoneKey: key })) throw new ApiError(409, "A member with this phone number already exists.");
  const now = new Date();
  const m = await Member.create({
    memberId: memberId(), name: i.name, phone: i.phone, phoneKey: key, email: i.email || undefined, zone: p.zone, area: p.area ?? null, parish: p._id,
    status: i.status, active: statusActive(i.status), category, dob: new Date(i.dob), gender: i.gender, joinedAt: i.joinedAt ? new Date(i.joinedAt) : now,
    departments: i.departments.filter((d) => mongoose.isValidObjectId(d)), leadership: i.leadership ? { ...i.leadership, since: now } : undefined,
    guardian: minor ? { ...i.guardian, consentAt: now, verifiedAt: now, verifiedByName: user.name } : undefined,
    consent: { privacyAt: now, by: "admin" }, createdBy: user.id,
    changes: [{ at: now, by: user.id, byName: user.name, field: "record", from: "", to: "Registered", reason: "" }],
  });
  await audit(user, "member.create", m.memberId, { minor }, req);
  return { id: String(m._id), memberId: m.memberId };
});
