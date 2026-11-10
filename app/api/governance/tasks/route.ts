import { z } from "zod";
import mongoose from "mongoose";
import { handle, audit } from "@/lib/api";
import { ApiError, requireApiUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { PERMS } from "@/lib/rbac";
import { dateStr, listFilter, loadGov, names, notifyMember, orgInput, orgOf, orgOut, pickMember, resolveOrg } from "@/lib/gov-server";
import { canManage, isOverdue, taskStats } from "@/lib/governance";
import { shapeTask } from "@/lib/gov-shape";

export const dynamic = "force-dynamic";

export const GET = handle(async (req) => {
  const user = await requireApiUser(PERMS.governance);
  const q = new URL(req.url).searchParams;
  const f = listFilter(user, q);
  for (const k of ["committee", "department", "meeting", "assignee"]) if (q.get(k) && mongoose.isValidObjectId(q.get(k))) f[k] = q.get(k);
  const { Task } = await getDb();
  const all = await Task.find(f).sort({ dueAt: 1, createdAt: -1 }).limit(500).lean<any[]>();
  const stats = taskStats(all);
  let rows = all;
  if (q.get("status")) rows = rows.filter((t) => t.status === q.get("status"));
  if (q.get("overdue") === "1") rows = rows.filter((t) => isOverdue(t));
  const n = await names();
  return { stats, rows: rows.map((t) => shapeTask(t, n, user)) };
});

const body = z.object({
  title: z.string().trim().min(2).max(200), description: z.string().trim().max(2000).default(""),
  assignee: z.string().optional(), dueAt: dateStr.optional(), priority: z.enum(["low", "normal", "high"]).default("normal"),
  committee: z.string().optional(), department: z.string().optional(), meeting: z.string().optional(),
  org: orgInput.optional(),
});

/** Create a task. A task inherits the organisational level of the committee, department or meeting it belongs to. */
export const POST = handle(async (req) => {
  const user = await requireApiUser(PERMS.governanceManage);
  const i = body.parse(await req.json());
  let org: any;
  if (i.committee) org = orgOf(await loadGov("Committee", i.committee, user, true));
  else if (i.meeting) org = orgOf(await loadGov("Meeting", i.meeting, user, true));
  else if (i.department) org = orgOf(await loadGov("Department", i.department, user, true));
  else if (i.org) org = await resolveOrg(user, i.org);
  else throw new ApiError(400, "Choose the level this task belongs to.");
  org = { level: org.level, zone: org.zone || undefined, area: org.area || undefined, parish: org.parish || undefined };
  let assignee: any = null;
  if (i.assignee) assignee = await pickMember(user, org, i.assignee);
  if (i.dueAt && Date.parse(i.dueAt) < Date.now() - 86_400_000) throw new ApiError(422, "The deadline can't be in the past.");
  const { Task } = await getDb();
  const t = await Task.create({ ...org, title: i.title, description: i.description, assignee: assignee?._id, assigneeName: assignee?.name, dueAt: i.dueAt ? new Date(i.dueAt) : undefined, priority: i.priority, committee: i.committee || undefined, department: i.department || undefined, meeting: i.meeting || undefined, createdBy: user.id, createdByName: user.name, updates: [{ at: new Date(), by: user.id, byName: user.name, status: "open", note: "Task created" }] });
  if (assignee) await notifyMember(assignee, { title: `New task: ${i.title}`, body: i.dueAt ? `Due ${new Date(i.dueAt).toLocaleDateString("en-NG", { dateStyle: "medium" })}` : undefined, link: "/member", event: "task_assigned" });
  await audit(user, "task.create", i.title, { assignee: assignee?.name }, req);
  return { id: String(t._id) };
});
