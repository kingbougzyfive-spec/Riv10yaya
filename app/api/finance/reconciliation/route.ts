import { handle } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { orgNames } from "@/lib/names";
import { PERMS } from "@/lib/rbac";
import { clampScope, recordScope } from "@/lib/scope";
import { ApiError } from "@/lib/errors";

export const dynamic = "force-dynamic";

/** Bank reconciliation: where each payment stands against the bank statement, scoped to the person's own organisation. */
export const GET = handle(async (req) => {
  const user = await requireApiUser(PERMS.finance);
  const scope = await recordScope(user);
  if (scope === null) throw new ApiError(403, "No access.");
  const q = new URL(req.url).searchParams;
  const f: any = { ...clampScope(scope, q) };
  if (q.get("year")) f.year = Number(q.get("year"));
  if (q.get("month")) f.month = Number(q.get("month"));
  if (q.get("outcome")) f.outcome = q.get("outcome");
  const { BankReconciliationRecord, PaymentTransaction } = await getDb();
  const [rows, n] = await Promise.all([BankReconciliationRecord.find(f).sort({ reconciledAt: -1 }).limit(500).lean<any[]>(), orgNames()]);
  const txns = await PaymentTransaction.find({ _id: { $in: rows.map((r) => r.transaction).filter(Boolean) } }, { ref: 1 }).lean<any[]>();
  const tref = new Map(txns.map((t) => [String(t._id), t.ref]));
  const out = rows.map((r) => ({
    id: String(r._id), remittance: String(r.remittance), parish: n.parish.get(String(r.parish)) ?? "", zone: n.zone.get(String(r.zone)) ?? "", area: r.area ? n.area.get(String(r.area)) ?? "" : "",
    month: r.month, year: r.year, declaredKobo: r.declaredKobo ?? 0, bankKobo: r.bankKobo ?? 0, bankReference: r.bankReference ?? "", outcome: r.outcome, by: r.reconciledByName ?? "", at: r.reconciledAt, note: r.note ?? "", transaction: r.transaction ? tref.get(String(r.transaction)) ?? "" : "",
  }));
  const count = (o: string) => out.filter((r) => r.outcome === o).length;
  return { rows: out, summary: { matched: count("matched"), not_found: count("not_found"), amount_mismatch: count("amount_mismatch"), rejected: count("rejected"), resubmission_requested: count("resubmission_requested") } };
});
