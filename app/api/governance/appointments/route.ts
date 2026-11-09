import { z } from "zod";
import { handle, audit } from "@/lib/api";
import { ApiError, requireApiUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { PERMS } from "@/lib/rbac";
import { dateStr, listFilter, names, orgInput, orgOut, pickMember, resolveOrg } from "@/lib/gov-server";
import { orgOf } from "@/lib/gov-server";
import { canManage } from "@/lib/governance";

export const dynamic = "force-dynamic";

const shape = (a: any, n: any, user: any) => ({
  id: String(a._id), ...orgOut(a, n), position: a.position, holderName: a.holderName, memberId: a.member ? String(a.member) : null, departmentId: a.department ? String(a.department) : null,
  responsibilities: a.responsibilities ?? [], startsAt: a.startsAt, endsAt: a.endsAt, status: a.status, endedAt: a.endedAt, endedReason: a.endedReason, canManage: canManage(user, orgOf(a)),
  history: (a.history ?? []).map((h: any) => ({ at: h.at, byName: h.byName, action: h.action, note: h.note })),
});

export const GET = handle(async (req) => {
  const user = await requireApiUser(PERMS.governance);
  const q = new URL(req.url).searchParams;
  const f = listFilter(user, q);
  if (q.get("status")) f.status = q.get("status");
  if (q.get("department")) f.department = q.get("department"); else if (q.get("scope") !== "all") f.department = { $exists: false };
  const { Appointment } = await getDb();
  const [rows, n] = await Promise.all([Appointment.find(f).sort({ level: 1, createdAt: -1 }).limit(500).lean<any[]>(), names()]);
  return { rows: rows.map((a) => shape(a, n, user)) };
});

const body = orgInput.extend({
  position: z.string().trim().min(2).max(100),
  member: z.string().optional(),
  holderName: z.string().trim().min(2).max(100).optional(),
  department: z.string().optional(),
  responsibilities: z.array(z.string().trim().min(2).max(300)).max(20).default([]),
  startsAt: dateStr.optional(), endsAt: dateStr.optional(),
});

/** Assign a leadership position (or department post). The holder is a member of that level, or a named person outside the CRM. */
export const POST = handle(async (req) => {
  const user = await requireApiUser(PERMS.governanceManage);
  const i = body.parse(await req.json());
  const org = await resolveOrg(user, i);
  const { Appointment, Department, Member } = await getDb();
  let holderName = i.holderName ?? "", member: any = null;
  if (i.member) { member = await pickMember(user, org, i.member); holderName = member.name; }
  if (!holderName) throw new ApiError(422, "Choose a member or enter the person's name.");
  if (i.department) {
    const d = await Department.findById(i.department).lean<any>();
    if (!d || String(d.level ?? "province") !== org.level || String(d.zone ?? "") !== String(org.zone ?? "") || String(d.area ?? "") !== String(org.area ?? "") || String(d.parish ?? "") !== String(org.parish ?? "")) throw new ApiError(422, "That department belongs to a different level.");
  }
  const now = new Date();
  const a = await Appointment.create({ ...org, position: i.position, member: member?._id, holderName, department: i.department || undefined, responsibilities: i.responsibilities, startsAt: i.startsAt ? new Date(i.startsAt) : now, endsAt: i.endsAt ? new Date(i.endsAt) : undefined, createdBy: user.id, history: [{ at: now, by: user.id, byName: user.name, action: "appointed", note: "" }] });
  // Keep the member's CRM record in step with their leadership title (departments' posts don't change it).
  if (member && !i.department) {
    member.changes.push({ at: now, by: user.id, byName: user.name, field: "leadership", from: member.leadership?.title ?? "", to: i.position, reason: "Appointed" });
    member.leadership = { title: i.position, level: org.level, since: now };
    await member.save();
  }
  await audit(user, "appointment.create", `${i.position}: ${holderName}`, { level: org.level }, req);
  return { id: String(a._id) };
});
