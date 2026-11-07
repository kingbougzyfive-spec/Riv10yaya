import { z } from "zod";
import { handle, audit } from "@/lib/api";
import { ApiError, requireApiUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { PERMS } from "@/lib/rbac";
import { loadGov, names, notifyMember, orgOf, orgOut, pickMember } from "@/lib/gov-server";
import { canManage, COMMITTEE_ROLES, taskStats } from "@/lib/governance";
import { memberRows } from "../route";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export const GET = handle<Ctx>(async (_req, ctx) => {
  const user = await requireApiUser(PERMS.governance);
  const c = await loadGov("Committee", (await ctx.params).id, user, false);
  const { Task, Meeting, GovDocument } = await getDb();
  const [tasks, meetings, docs, n] = await Promise.all([
    Task.find({ committee: c._id }).sort({ dueAt: 1 }).limit(100).lean<any[]>(), Meeting.find({ committee: c._id }).sort({ scheduledAt: -1 }).limit(30).lean<any[]>(),
    GovDocument.find({ committee: c._id }).sort({ createdAt: -1 }).limit(50).lean<any[]>(), names(),
  ]);
  return {
    committee: { id: String(c._id), name: c.name, purpose: c.purpose ?? "", ...orgOut(c, n), status: c.status, formedAt: c.formedAt, dissolvedAt: c.dissolvedAt, responsibilities: c.responsibilities ?? [], members: memberRows(c), canManage: canManage(user, orgOf(c)), history: (c.history ?? []).map((h: any) => ({ at: h.at, byName: h.byName, action: h.action, note: h.note })).reverse() },
    tasks: tasks.map((t) => ({ id: String(t._id), title: t.title, assigneeName: t.assigneeName, dueAt: t.dueAt, status: t.status })), taskStats: taskStats(tasks),
    meetings: meetings.map((m) => ({ id: String(m._id), title: m.title, scheduledAt: m.scheduledAt, status: m.status })),
    documents: docs.map((d) => ({ id: String(d._id), title: d.title, category: d.category, fileName: d.fileName, mediaId: String(d.media) })),
  };
});

const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("update"), name: z.string().trim().min(2).max(120).optional(), purpose: z.string().trim().max(1000).optional(), responsibilities: z.array(z.string().trim().min(2).max(300)).max(20).optional() }),
  z.object({ action: z.literal("add_member"), member: z.string(), role: z.enum(COMMITTEE_ROLES).default("member") }),
  z.object({ action: z.literal("set_role"), rowId: z.string(), role: z.enum(COMMITTEE_ROLES) }),
  z.object({ action: z.literal("remove_member"), rowId: z.string(), reason: z.string().trim().max(200).optional().default("") }),
  z.object({ action: z.literal("dissolve"), reason: z.string().trim().min(2).max(300) }),
]);

const SINGLE = ["chair", "secretary", "treasurer", "vice_chair"];

export const PATCH = handle<Ctx>(async (req, ctx) => {
  const user = await requireApiUser(PERMS.governanceManage);
  const c = await loadGov("Committee", (await ctx.params).id, user, true);
  const i = body.parse(await req.json());
  const now = new Date();
  const log = (action: string, note = "") => c.history.push({ at: now, by: user.id, byName: user.name, action, note });
  if (c.status === "dissolved" && i.action !== "update") throw new ApiError(409, "This committee has been dissolved.");
  // Each office (chair, secretary…) has one holder at a time.
  const taken = (role: string, except?: string) => role !== "member" && c.members.some((m: any) => m.active && m.role === role && String(m._id) !== except);

  if (i.action === "update") { if (i.name) c.name = i.name; if (i.purpose !== undefined) c.purpose = i.purpose; if (i.responsibilities) c.responsibilities = i.responsibilities; log("updated"); }
  else if (i.action === "add_member") {
    const org = orgOf(c);
    const m = await pickMember(user, org, i.member);
    if (c.members.some((x: any) => x.active && String(x.member) === String(m._id))) throw new ApiError(409, `${m.name} is already on this committee.`);
    if (SINGLE.includes(i.role) && taken(i.role)) throw new ApiError(409, `This committee already has a ${i.role.replace("_", " ")}. Change their role first.`);
    c.members.push({ member: m._id, name: m.name, role: i.role, since: now, active: true });
    log("member added", `${m.name} (${i.role})`);
    await notifyMember(m, { title: `You were added to ${c.name}`, body: `Role: ${i.role.replace("_", " ")}`, link: "/me" });
  } else if (i.action === "set_role") {
    const row = c.members.id(i.rowId);
    if (!row || !row.active) throw new ApiError(404, "Member not found on this committee.");
    if (SINGLE.includes(i.role) && taken(i.role, i.rowId)) throw new ApiError(409, `This committee already has a ${i.role.replace("_", " ")}.`);
    log("role changed", `${row.name}: ${row.role} → ${i.role}`); row.role = i.role;
  } else if (i.action === "remove_member") {
    const row = c.members.id(i.rowId);
    if (!row || !row.active) throw new ApiError(404, "Member not found on this committee.");
    row.active = false; row.until = now; log("member removed", `${row.name}${i.reason ? ": " + i.reason : ""}`);
  } else { c.status = "dissolved"; c.dissolvedAt = now; log("dissolved", i.reason); }
  await c.save();
  await audit(user, `committee.${i.action}`, c.name, undefined, req);
  return { ok: true };
});
