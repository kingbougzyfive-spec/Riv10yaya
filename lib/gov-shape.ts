import { orgOf, orgOut } from "./gov-server";
import { attendanceStats, canManage, isOverdue, taskStats } from "./governance";

/** Response shapes shared by the governance routes (kept out of route files, which may only export HTTP handlers). */
export const shapeTask = (t: any, n: any, user: any) => ({
  id: String(t._id), title: t.title, description: t.description ?? "", ...orgOut(t, n), assigneeId: t.assignee ? String(t.assignee) : null, assigneeName: t.assigneeName ?? "", dueAt: t.dueAt, priority: t.priority, status: t.status,
  overdue: isOverdue(t), completedAt: t.completedAt, committeeId: t.committee ? String(t.committee) : null, departmentId: t.department ? String(t.department) : null, meetingId: t.meeting ? String(t.meeting) : null,
  canManage: canManage(user, orgOf(t)), updates: (t.updates ?? []).map((u: any) => ({ at: u.at, byName: u.byName, status: u.status, note: u.note })).reverse(), createdByName: t.createdByName,
});

export const shapeMeeting = (m: any, n: any, user: any) => ({
  id: String(m._id), title: m.title, bodyKind: m.bodyKind, committeeId: m.committee ? String(m.committee) : null, departmentId: m.department ? String(m.department) : null, ...orgOut(m, n),
  scheduledAt: m.scheduledAt, venue: m.venue ?? "", agenda: m.agenda ?? "", status: m.status, attendance: attendanceStats(m.attendance ?? []), hasMinutes: !!m.minutes, decisions: (m.decisions ?? []).length, canManage: canManage(user, orgOf(m)),
});

export const memberRows = (c: any) => (c.members ?? []).map((m: any) => ({ id: String(m._id), memberId: m.member ? String(m.member) : null, name: m.name, role: m.role, since: m.since, until: m.until, active: m.active }));
