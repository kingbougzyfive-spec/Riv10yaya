import type { ClientSession } from "mongoose";
import type { SessionUser } from "./auth";
import { ApiError } from "./errors";
import { createsTransaction, newRef, normRef, outcomeFor, type Decision } from "./ledger-core";

type Db = Record<string, any>;
export type DecisionInput = {
  db: Db; user: SessionUser; r: any; p: any; paymentKey: string; action: Decision;
  fromStatus?: string; toStatus?: string; reason?: string; note?: string; bankReference?: string;
  seenKobo?: number; confirmedKobo?: number; adjustmentKobo?: number; evidenceId?: string; session?: ClientSession;
};

/** Writes the permanent records of one finance decision: the approval (always), the bank-reconciliation state
 *  (for matching outcomes) and, only for a confirmation, one ledger row of confirmed money. Call it inside
 *  withTx together with the Remittance save, with the ledger write FIRST so a duplicate bank reference or a
 *  second confirmation is refused before anything else is saved. */
export async function recordDecision(x: DecisionInput) {
  const { db, user, r, p, session } = x;
  const ses = session ? { session } : {};
  const ref = normRef(x.bankReference);
  const where = { zone: r.zone, area: r.area ?? null, parish: r.parish, month: r.month, year: r.year, period: r.period };
  let txn: any;
  if (createsTransaction(x.action, x.confirmedKobo)) {
    try {
      [txn] = await db.PaymentTransaction.create([{
        ref: newRef("TXN"), remittance: r._id, paymentKey: x.paymentKey, kind: r.kind, category: r.category ?? "levy", ...where,
        amountKobo: x.confirmedKobo, declaredKobo: p.amountKobo, bankReference: ref, confirmedBy: user.id, confirmedByName: user.name,
      }], ses);
    } catch (e: any) {
      if (e?.code === 11000) {
        throw new ApiError(409, e.keyPattern?.bankReference ? "That bank reference has already been confirmed against another payment. Check for a duplicate receipt before confirming." : "This payment has already been confirmed.");
      }
      throw e;
    }
  }
  const [approval] = await db.FinancialApproval.create([{
    remittance: r._id, paymentKey: x.paymentKey, ...where, action: x.action, fromStatus: x.fromStatus, toStatus: x.toStatus,
    declaredKobo: p.amountKobo, seenKobo: x.seenKobo, confirmedKobo: x.confirmedKobo, adjustmentKobo: x.adjustmentKobo,
    bankReference: ref, reason: x.reason, note: x.note, evidence: x.evidenceId || undefined, transaction: txn?._id,
    decidedBy: user.id, decidedByName: user.name, decidedByRole: user.role,
  }], ses);
  const outcome = outcomeFor(x.action);
  if (outcome) {
    await db.BankReconciliationRecord.findOneAndUpdate(
      { remittance: r._id, paymentKey: x.paymentKey },
      { $set: { ...where, declaredKobo: p.amountKobo, bankKobo: outcome === "matched" ? x.confirmedKobo : outcome === "amount_mismatch" ? x.seenKobo ?? 0 : 0, bankReference: ref, outcome, reconciledBy: user.id, reconciledByName: user.name, reconciledAt: new Date(), transaction: txn?._id, note: x.reason || x.note }, $setOnInsert: { remittance: r._id, paymentKey: x.paymentKey } },
      { upsert: true, ...ses },
    );
  }
  return { approval, transaction: txn };
}

/** Confirmed money according to the remittance records vs the ledger. They must agree; the difference lists what to fix. */
export async function ledgerCheck(db: Db) {
  const rems = await db.Remittance.find({ $or: [{ status: "confirmed" }, { "payments.status": "confirmed" }] }, { payments: 1, status: 1, confirmedKobo: 1, kind: 1, parish: 1, month: 1, year: 1 }).lean();
  const expected = new Map<string, { remittance: string; paymentKey: string; kobo: number }>();
  for (const r of rems) {
    if (r.status === "confirmed") expected.set(`${r._id}:primary`, { remittance: String(r._id), paymentKey: "primary", kobo: r.confirmedKobo ?? 0 });
    for (const q of r.payments ?? []) if (q.status === "confirmed") expected.set(`${r._id}:${q._id}`, { remittance: String(r._id), paymentKey: String(q._id), kobo: q.confirmedKobo ?? 0 });
  }
  const txns = await db.PaymentTransaction.find({}, { remittance: 1, paymentKey: 1, amountKobo: 1 }).lean();
  const have = new Map<string, number>(txns.map((t: any) => [`${t.remittance}:${t.paymentKey}`, t.amountKobo]));
  const missing = [...expected.entries()].filter(([k]) => !have.has(k)).map(([, v]) => v);
  const mismatched = [...expected.entries()].filter(([k, v]) => have.has(k) && have.get(k) !== v.kobo).map(([k, v]) => ({ ...v, ledgerKobo: have.get(k) }));
  const sum = (a: number[]) => a.reduce((n, x) => n + x, 0);
  return { remittanceConfirmedKobo: sum([...expected.values()].map((v) => v.kobo)), ledgerKobo: sum([...have.values()]), missing, mismatched, ok: !missing.length && !mismatched.length };
}

/** Creates ledger rows for confirmed payments recorded before the ledger existed. Safe to repeat. */
export async function backfillLedger(db: Db, user: SessionUser) {
  const { missing } = await ledgerCheck(db);
  let made = 0;
  for (const m of missing) {
    const r = await db.Remittance.findById(m.remittance).lean();
    if (!r) continue;
    const p = m.paymentKey === "primary" ? r : (r.payments ?? []).find((q: any) => String(q._id) === m.paymentKey);
    if (!p || !m.kobo) continue;
    try {
      await db.PaymentTransaction.create({ ref: newRef("TXN"), remittance: r._id, paymentKey: m.paymentKey, kind: r.kind, category: r.category ?? "levy", zone: r.zone, area: r.area ?? null, parish: r.parish, month: r.month, year: r.year, amountKobo: m.kobo, declaredKobo: p.amountKobo, bankReference: normRef(p.reference), confirmedBy: p.reviewedBy, confirmedByName: "Imported from earlier records", confirmedAt: p.reviewedAt ?? new Date() });
      made++;
    } catch (e: any) { if (e?.code !== 11000) throw e; } // already present, or the bank reference was used elsewhere: left for a human to look at
  }
  return { made, user: user.id };
}
