import { z } from "zod";
import { handle, audit } from "@/lib/api";
import { ApiError, requireApiUser } from "@/lib/auth";
import { PERMS } from "@/lib/rbac";
import { dateStr, loadGov, notifyMember, orgOf, pickMember } from "@/lib/gov-server";
import { TASK_STATUSES } from "@/lib/governance";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

const body = z.object({
  status: z.enum(TASK_STATUSES).optional(), note: z.string().trim().max(1000).optional().default(""),
  title: z.string().trim().min(2).max(200).optional(), description: z.string().trim().max(2000).optional(),
  assignee: z.string().optional(), dueAt: dateStr.or(z.literal("")).optional(), priority: z.enum(["low", "normal", "high"]).optional(),
});

/** Update progress, deadline or assignee. Every change is kept in the task's own history. */
export const PATCH = handle<Ctx>(async (req, ctx) => {
  const user = await requireApiUser(PERMS.governanceManage);
  const t = await loadGov("Task", (await ctx.params).id, user, true);
  const i = body.parse(await req.json());
  const now = new Date();
  const notes: string[] = [];
  if (i.title) t.title = i.title;
  if (i.description !== undefined) t.description = i.description;
  if (i.priority) t.priority = i.priority;
  if (i.dueAt !== undefined) { t.dueAt = i.dueAt ? new Date(i.dueAt) : undefined; notes.push(i.dueAt ? `deadline ${i.dueAt}` : "deadline removed"); }
  if (i.assignee && i.assignee !== String(t.assignee ?? "")) {
    const m = await pickMember(user, orgOf(t), i.assignee);
    t.assignee = m._id; t.assigneeName = m.name; notes.push(`assigned to ${m.name}`);
    await notifyMember(m, { title: `New task: ${t.title}`, link: "/me", event: "task_assigned" });
  }
  if (i.status && i.status !== t.status) {
    if (t.status === "cancelled" || (t.status === "done" && i.status !== "open")) throw new ApiError(409, "A finished task can only be reopened.");
    notes.push(`status ${t.status} → ${i.status}`);
    t.status = i.status; t.completedAt = i.status === "done" ? now : undefined;
  }
  if (!notes.length && !i.note && !i.title && !i.description && !i.priority) return { ok: true };
  t.updates.push({ at: now, by: user.id, byName: user.name, status: t.status, note: [notes.join("; "), i.note].filter(Boolean).join(". ") });
  await t.save();
  await audit(user, "task.update", t.title, { status: t.status }, req);
  return { ok: true };
});
