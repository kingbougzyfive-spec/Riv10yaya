import { z } from "zod";
import { handle, audit } from "@/lib/api";
import { ApiError, requireApiUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { PERMS } from "@/lib/rbac";
import { dateStr, loadGov, names, notifyMember, orgOf, pickMember } from "@/lib/gov-server";
import { attendanceStats } from "@/lib/governance";
import { shapeMeeting } from "../route";
import { shapeTask } from "../../tasks/route";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export const GET = handle<Ctx>(async (_req, ctx) => {
  const user = await requireApiUser(PERMS.governance);
  const m = await loadGov("Meeting", (await ctx.params).id, user, false);
  const { Task, GovDocument } = await getDb();
  const [tasks, docs, n] = await Promise.all([Task.find({ meeting: m._id }).sort({ dueAt: 1 }).lean<any[]>(), GovDocument.find({ meeting: m._id }).lean<any[]>(), names()]);
  return {
    meeting: { ...shapeMeeting(m, n, user), minutes: m.minutes ?? "", minutesBy: m.minutesBy, minutesAt: m.minutesAt },
    attendance: (m.attendance ?? []).map((a: any) => ({ id: String(a._id), memberId: a.member ? String(a.member) : null, name: a.name, status: a.status })),
    decisions: (m.decisions ?? []).map((d: any) => ({ id: String(d._id), text: d.text, at: d.at, byName: d.byName })),
    actions: (m.actions ?? []).map((a: any) => ({ id: String(a._id), text: a.text, assigneeName: a.assigneeName, dueAt: a.dueAt, taskId: a.task ? String(a.task) : null })),
    tasks: tasks.map((t) => shapeTask(t, n, user)),
    documents: docs.map((d) => ({ id: String(d._id), title: d.title, category: d.category, fileName: d.fileName, mediaId: String(d.media) })),
  };
});

const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("update"), title: z.string().trim().min(2).max(200).optional(), scheduledAt: dateStr.optional(), venue: z.string().trim().max(200).optional(), agenda: z.string().trim().max(4000).optional() }),
  z.object({ action: z.literal("cancel"), reason: z.string().trim().max(300).optional().default("") }),
  z.object({ action: z.literal("attendance"), rows: z.array(z.object({ id: z.string(), status: z.enum(["present", "absent", "apology"]) })).max(300) }),
  z.object({ action: z.literal("add_attendee"), member: z.string(), status: z.enum(["present", "absent", "apology"]).default("present") }),
  z.object({ action: z.literal("minutes"), minutes: z.string().trim().min(5).max(20000) }),
  z.object({ action: z.literal("decision_add"), text: z.string().trim().min(3).max(1000) }),
  z.object({ action: z.literal("action_add"), text: z.string().trim().min(3).max(500), assignee: z.string().optional(), dueAt: dateStr.optional() }),
]);

export const PATCH = handle<Ctx>(async (req, ctx) => {
  const user = await requireApiUser(PERMS.governanceManage);
  const m = await loadGov("Meeting", (await ctx.params).id, user, true);
  const i = body.parse(await req.json());
  const now = new Date();
  const started = m.scheduledAt.getTime() <= now.getTime();
  if (m.status === "cancelled" && i.action !== "update") throw new ApiError(409, "This meeting was cancelled.");

  if (i.action === "update") { if (i.title) m.title = i.title; if (i.scheduledAt) { m.scheduledAt = new Date(i.scheduledAt); } if (i.venue !== undefined) m.venue = i.venue; if (i.agenda !== undefined) m.agenda = i.agenda; }
  else if (i.action === "cancel") { if (m.status === "held") throw new ApiError(409, "A meeting that was held can't be cancelled."); m.status = "cancelled"; }
  else if (i.action === "attendance") {
    if (!started) throw new ApiError(409, "You can record attendance once the meeting has started.");
    for (const r of i.rows) { const a = m.attendance.id(r.id); if (a) a.status = r.status; }
    if (m.status === "scheduled") m.status = "held";
  } else if (i.action === "add_attendee") {
    if (!started) throw new ApiError(409, "You can record attendance once the meeting has started.");
    const mem = await pickMember(user, orgOf(m), i.member);
    if (m.attendance.some((a: any) => String(a.member) === String(mem._id))) throw new ApiError(409, `${mem.name} is already on the list.`);
    m.attendance.push({ member: mem._id, name: mem.name, status: i.status });
    if (m.status === "scheduled") m.status = "held";
  } else if (i.action === "minutes") {
    if (!started) throw new ApiError(409, "Minutes can be written once the meeting has started.");
    m.minutes = i.minutes; m.minutesBy = user.name; m.minutesAt = now; if (m.status === "scheduled") m.status = "held";
  } else if (i.action === "decision_add") m.decisions.push({ text: i.text, at: now, byName: user.name });
  else {
    const { Task } = await getDb();
    let who: any = null;
    if (i.assignee) who = await pickMember(user, orgOf(m), i.assignee);
    const org = orgOf(m);
    // An action point becomes a real task, so it is tracked and can be completed.
    const t = await Task.create({ level: org.level, zone: org.zone || undefined, area: org.area || undefined, parish: org.parish || undefined, title: i.text, assignee: who?._id, assigneeName: who?.name, dueAt: i.dueAt ? new Date(i.dueAt) : undefined, meeting: m._id, committee: m.committee, department: m.department, description: `Action point from: ${m.title}`, createdBy: user.id, createdByName: user.name, updates: [{ at: now, by: user.id, byName: user.name, status: "open", note: "From meeting action point" }] });
    m.actions.push({ text: i.text, assignee: who?._id, assigneeName: who?.name, dueAt: i.dueAt ? new Date(i.dueAt) : undefined, task: t._id });
    if (who) await notifyMember(who, { title: `Action point: ${i.text}`, link: "/me" });
  }
  await m.save();
  await audit(user, `meeting.${i.action}`, m.title, i.action === "attendance" ? attendanceStats(m.attendance) : undefined, req);
  return { ok: true };
});
