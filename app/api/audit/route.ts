import { handle, audit } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { HOUR, rateLimit } from "@/lib/ratelimit";
import { PERMS } from "@/lib/rbac";

export const dynamic = "force-dynamic";

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const cell = (v: unknown) => {
  let t = v === undefined || v === null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
  if (/^[=+\-@\t\r]/.test(t)) t = "'" + t; // stop spreadsheets running a cell as a formula
  return `"${t.replace(/"/g, '""')}"`;
};

/** Read-only audit trail for Super Administrators and Auditors. There is no write, edit or delete route. */
export const GET = handle(async (req) => {
  const user = await requireApiUser(PERMS.audit);
  const q = new URL(req.url).searchParams;
  const f: any = {};
  const action = q.get("action")?.trim();
  if (action) f.action = action.endsWith("*") ? { $regex: "^" + esc(action.slice(0, -1)) } : action;
  const entity = q.get("entity")?.trim();
  if (entity) f.entity = entity;
  const actor = q.get("actor")?.trim();
  if (actor) f.$or = [{ actorName: { $regex: esc(actor), $options: "i" } }, { actorEmail: { $regex: esc(actor), $options: "i" } }];
  const text = q.get("q")?.trim();
  if (text) f.$and = [{ $or: [{ target: { $regex: esc(text), $options: "i" } }, { reason: { $regex: esc(text), $options: "i" } }, { entityId: text }] }];
  const from = q.get("from") ? new Date(`${q.get("from")}T00:00:00+01:00`) : null;
  const to = q.get("to") ? new Date(`${q.get("to")}T23:59:59.999+01:00`) : null;
  const before = q.get("before") ? new Date(q.get("before")!) : null;
  const range: any = {};
  if (from && !isNaN(+from)) range.$gte = from;
  if (to && !isNaN(+to)) range.$lte = to;
  if (before && !isNaN(+before)) range.$lt = before;
  if (Object.keys(range).length) f.createdAt = range;
  const { Audit } = await getDb();

  if (q.get("format") === "csv") {
    await rateLimit(`auditx:${user.id}`, 10, HOUR, "Too many audit exports this hour.");
    const rows = await Audit.find(f).sort({ createdAt: -1 }).limit(5000).lean<any[]>();
    await audit(user, "audit.export", "audit log", { entity: "audit", after: { rows: rows.length, filters: Object.fromEntries(q.entries()) } }, req);
    const head = ["When (UTC)", "Actor", "Email", "Role", "Action", "Record", "Entity", "Entity ID", "Before", "After", "Reason", "Detail", "IP"];
    const body = rows.map((r) => [r.createdAt.toISOString(), r.actorName, r.actorEmail, r.actorRole, r.action, r.target, r.entity, r.entityId, r.before, r.after, r.reason, r.detail, r.ip].map(cell).join(","));
    return new Response("﻿" + [head.map(cell).join(","), ...body].join("\r\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="audit-log-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store" } });
  }

  const limit = Math.min(100, Number(q.get("limit")) || 50);
  const [rows, actions] = await Promise.all([
    Audit.find(f).sort({ createdAt: -1 }).limit(limit + 1).lean<any[]>(),
    q.get("meta") ? Audit.distinct("action") : Promise.resolve(null),
  ]);
  const more = rows.length > limit;
  const page = rows.slice(0, limit);
  return {
    rows: page.map((r) => ({
      id: String(r._id), at: r.createdAt, action: r.action, actorName: r.actorName ?? null, actorEmail: r.actorEmail ?? null, actorRole: r.actorRole ?? null,
      target: r.target ?? null, entity: r.entity ?? null, entityId: r.entityId ?? null, before: r.before ?? null, after: r.after ?? null, reason: r.reason ?? null, detail: r.detail ?? null, ip: r.ip ?? null, userAgent: r.userAgent ?? null,
    })),
    next: more ? page[page.length - 1].createdAt : null,
    ...(actions ? { actions: (actions as string[]).sort() } : {}),
  };
});
