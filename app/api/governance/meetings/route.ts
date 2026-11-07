import { z } from "zod";
import mongoose from "mongoose";
import { handle, audit } from "@/lib/api";
import { ApiError, requireApiUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { PERMS } from "@/lib/rbac";
import { dateStr, listFilter, loadGov, names, notifyMember, orgInput, orgOf, orgOut, resolveOrg } from "@/lib/gov-server";
import { attendanceStats, canManage } from "@/lib/governance";

export const dynamic = "force-dynamic";

export const shapeMeeting = (m: any, n: any, user: any) => ({
  id: String(m._id), title: m.title, bodyKind: m.bodyKind, committeeId: m.committee ? String(m.committee) : null, departmentId: m.department ? String(m.department) : null, ...orgOut(m, n),
  scheduledAt: m.scheduledAt, venue: m.venue ?? "", agenda: m.agenda ?? "", status: m.status, attendance: attendanceStats(m.attendance ?? []), hasMinutes: !!m.minutes, decisions: (m.decisions ?? []).length, canManage: canManage(user, orgOf(m)),
});

export const GET = handle(async (req) => {
  const user = await requireApiUser(PERMS.governance);
  const q = new URL(req.url).searchParams;
  const f = listFilter(user, q);
  for (const k of ["committee", "department"]) if (q.get(k) && mongoose.isValidObjectId(q.get(k))) f[k] = q.get(k);
  if (q.get("status")) f.status = q.get("status");
  const { Meeting } = await getDb();
  const [rows, n] = await Promise.all([Meeting.find(f).sort({ scheduledAt: -1 }).limit(200).lean<any[]>(), names()]);
  return { rows: rows.map((m) => shapeMeeting(m, n, user)) };
});

const body = z.object({
  title: z.string().trim().min(2).max(200), scheduledAt: dateStr, venue: z.string().trim().max(200).default(""), agenda: z.string().trim().max(4000).default(""),
  committee: z.string().optional(), department: z.string().optional(),
  bodyKind: z.enum(["committee", "department", "leadership", "other"]).optional(),
  org: orgInput.optional(),
});

export const POST = handle(async (req) => {
  const user = await requireApiUser(PERMS.governanceManage);
  const i = body.parse(await req.json());
  const { Meeting, Committee } = await getDb();
  let org: any, kind = i.bodyKind ?? "other", attendance: any[] = [], committee: any = null;
  if (i.committee) { committee = await loadGov("Committee", i.committee, user, true); org = orgOf(committee); kind = "committee"; attendance = committee.members.filter((m: any) => m.active).map((m: any) => ({ member: m.member, name: m.name, status: "absent" })); }
  else if (i.department) { org = orgOf(await loadGov("Department", i.department, user, true)); kind = "department"; }
  else if (i.org) org = await resolveOrg(user, i.org);
  else throw new ApiError(400, "Choose the committee, department or level this meeting belongs to.");
  org = { level: org.level, zone: org.zone || undefined, area: org.area || undefined, parish: org.parish || undefined };
  const when = new Date(i.scheduledAt);
  const m = await Meeting.create({ ...org, title: i.title, bodyKind: kind, committee: i.committee || undefined, department: i.department || undefined, scheduledAt: when, venue: i.venue, agenda: i.agenda, attendance, createdBy: user.id });
  // Tell committee members who have an account.
  if (committee) {
    const { Member } = await getDb();
    const ms = await Member.find({ _id: { $in: committee.members.filter((x: any) => x.active && x.member).map((x: any) => x.member) } }).limit(100);
    await Promise.all(ms.map((mem: any) => notifyMember(mem, { title: `Meeting: ${i.title}`, body: `${when.toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}${i.venue ? ` · ${i.venue}` : ""}`, link: "/me" })));
  }
  void Committee;
  await audit(user, "meeting.create", i.title, { kind }, req);
  return { id: String(m._id) };
});
