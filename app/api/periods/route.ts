import { z } from "zod";
import { handle, auditChange } from "@/lib/api";
import { ApiError, requireApiUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { periodDue, periodKey, periodLabel, validPeriod } from "@/lib/period";
import { PERMS } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  await requireApiUser(PERMS.adminArea);
  const { ReportingPeriod } = await getDb();
  const rows = await ReportingPeriod.find().sort({ year: -1, month: -1 }).limit(60).lean<any[]>();
  return { periods: rows.map((p) => ({ id: String(p._id), key: p.key, year: p.year, month: p.month, label: p.label, dueAt: p.dueAt, status: p.status })) };
});

/** Open, close or lock a month. Locking stops new submissions for that month; finance decisions can still be made. */
export const PATCH = handle(async (req) => {
  const user = await requireApiUser(["super_admin", "provincial_admin", "finance_admin"]);
  const i = z.object({ year: z.number().int(), month: z.number().int(), status: z.enum(["open", "closed", "locked"]), reason: z.string().trim().min(3).max(500) }).parse(await req.json());
  if (!validPeriod(i.year, i.month)) throw new ApiError(400, "That isn't a valid month.");
  const { ReportingPeriod } = await getDb();
  const cur = await ReportingPeriod.findOne({ key: periodKey(i.year, i.month) });
  const before = { status: cur?.status ?? "open" };
  const doc = cur ?? new ReportingPeriod({ key: periodKey(i.year, i.month), year: i.year, month: i.month, label: periodLabel(i.year, i.month), dueAt: periodDue(i.year, i.month) });
  doc.status = i.status;
  doc.statusHistory.push({ by: user.id, byName: user.name, status: i.status, reason: i.reason });
  await doc.save();
  await auditChange(user, "period.status_change", doc.label, { entity: "reporting_period", entityId: String(doc._id), before, after: { status: i.status }, reason: i.reason }, req);
  return { ok: true };
});
