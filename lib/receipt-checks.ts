import { getDb } from "./db";
import type { ReceiptReading } from "./ai-receipt";

/**
 * Receipt examination helpers. Everything here is advisory: flags prompt a human look and never change a payment's
 * status. A flag is not an accusation, and a clean result is not proof that money reached the provincial account.
 */
export type Flag = { code: string; level: "info" | "warn" | "alert"; label: string; detail?: string };

const norm = (s?: string | null) => (s ?? "").replace(/[^a-z0-9]/gi, "").toLowerCase();
const monthName = (m: number) => new Date(2000, m - 1, 1).toLocaleString("en", { month: "long" });

/** Repeated file or repeated transaction reference across other payment records. Works without any AI key. */
export async function duplicateChecks(r: { _id: any; evidenceId?: any; reference?: string }) {
  const { Media, Remittance, Parish } = await getDb();
  const out = { file: [] as { id: string; parish: string; period: string }[], reference: [] as { id: string; parish: string; period: string }[] };
  const label = async (rows: any[]) => {
    const ps = new Map<string, string>((await Parish.find({ _id: { $in: rows.map((x) => x.parish) } }, { name: 1 }).lean<any[]>()).map((p: any): [string, string] => [String(p._id), p.name]));
    return rows.map((x) => ({ id: String(x._id), parish: ps.get(String(x.parish)) ?? "Unknown parish", period: `${monthName(x.month)} ${x.year}` }));
  };
  if (r.evidenceId) {
    const m = await Media.findById(r.evidenceId, { hash: 1 }).lean<any>();
    if (m?.hash) {
      const same = await Media.find({ hash: m.hash, _id: { $ne: r.evidenceId } }, { _id: 1 }).lean<any[]>();
      if (same.length) { const ids = same.map((x) => x._id); out.file = await label(await Remittance.find({ $or: [{ evidenceId: { $in: ids } }, { "payments.evidenceId": { $in: ids } }], _id: { $ne: r._id } }, { parish: 1, month: 1, year: 1 }).limit(10).lean<any[]>()); }
      // The same file attached to two different records (even if the Media row is shared) also counts.
      const shared = await Remittance.find({ evidenceId: r.evidenceId, _id: { $ne: r._id } }, { parish: 1, month: 1, year: 1 }).limit(10).lean<any[]>();
      if (shared.length) out.file = [...out.file, ...(await label(shared))];
    }
  }
  const ref = norm(r.reference);
  if (ref.length >= 4) {
    const cands = await Remittance.find({ _id: { $ne: r._id }, $or: [{ reference: { $exists: true, $ne: "" } }, { "payments.reference": { $exists: true, $ne: "" } }] }, { parish: 1, month: 1, year: 1, reference: 1, "payments.reference": 1 }).limit(5000).lean<any[]>();
    const hit = cands.filter((c) => norm(c.reference) === ref || (c.payments ?? []).some((x: any) => norm(x.reference) === ref));
    if (hit.length) out.reference = await label(hit.slice(0, 10));
  }
  return out;
}

const dupText = (l: { parish: string; period: string }[]) => l.map((x) => `${x.parish} (${x.period})`).join(", ");

export function flagsFromDuplicates(d: Awaited<ReturnType<typeof duplicateChecks>> | null | undefined): Flag[] {
  const f: Flag[] = [];
  if (d?.file?.length) f.push({ code: "duplicate_file", level: "alert", label: "The same file was uploaded before", detail: `Identical file found on: ${dupText(d.file)}. This can happen innocently (e.g. one transfer covering several items), so please check.` });
  if (d?.reference?.length) f.push({ code: "duplicate_reference", level: "alert", label: "This payment reference was used before", detail: `Same reference found on: ${dupText(d.reference)}.` });
  return f;
}

type Ctx = {
  reading: ReceiptReading;
  declaredNaira: number;
  declaredPaidAt: Date;
  declaredReference?: string;
  expectedNaira?: number; // yst only
  month: number;
  year: number;
  bank: { bankName: string; accountName: string; accountNumber: string };
  parishName?: string;
};

/** Compare what the receipt appears to say with what was declared, the expected 40%, the official account and the period. */
export function examine(c: Ctx): Flag[] {
  const f: Flag[] = [];
  const r = c.reading;
  const money = (n: number) => `₦${n.toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;

  if (r.amountNaira !== null) {
    if (Math.abs(r.amountNaira - c.declaredNaira) >= 0.01) f.push({ code: "amount_mismatch", level: "alert", label: "Receipt amount differs from the declared amount", detail: `Receipt ${money(r.amountNaira)} · declared ${money(c.declaredNaira)}.` });
    if (c.expectedNaira !== undefined && Math.abs(r.amountNaira - c.expectedNaira) >= 0.01 && Math.abs(r.amountNaira - c.declaredNaira) < 0.01)
      f.push({ code: "amount_vs_expected", level: "warn", label: "Amount differs from the expected remittance", detail: `Receipt ${money(r.amountNaira)} · expected ${money(c.expectedNaira)}.` });
  }

  // Beneficiary: compare against the official provincial account when it has been set.
  const acct = norm(c.bank.accountNumber), got = norm(r.beneficiaryAccount);
  if (!acct) f.push({ code: "bank_not_set", level: "info", label: "Official account details are not set, so the beneficiary could not be compared" });
  else if (got) {
    const masked = (r.beneficiaryAccount ?? "").includes("*") || (r.beneficiaryAccount ?? "").includes("•");
    const tail = (s: string) => s.replace(/\D/g, "").slice(-4);
    const okAcc = masked ? tail(got) === tail(acct) : got.replace(/\D/g, "") === acct.replace(/\D/g, "");
    if (!okAcc) f.push({ code: "wrong_beneficiary", level: "alert", label: "Beneficiary account differs from the official account", detail: `Receipt shows ${r.beneficiaryAccount}${masked ? " (partly hidden)" : ""}; official account ends ${acct.slice(-4)}.` });
  } else if (r.beneficiaryName && c.bank.accountName) {
    const a = norm(r.beneficiaryName), b = norm(c.bank.accountName);
    const words = c.bank.accountName.toLowerCase().split(/\W+/).filter((w) => w.length > 2);
    const shared = words.filter((w) => a.includes(w)).length;
    if (!(a.includes(b) || b.includes(a)) && shared < Math.min(2, words.length)) f.push({ code: "wrong_beneficiary", level: "warn", label: "Beneficiary name differs from the official account name", detail: `Receipt shows “${r.beneficiaryName}”.` });
  } else f.push({ code: "beneficiary_unreadable", level: "warn", label: "Beneficiary details could not be read from the receipt" });

  if (!norm(r.reference)) f.push({ code: "missing_reference", level: "warn", label: "No transaction reference could be read on the receipt" });
  else if (c.declaredReference && norm(c.declaredReference) && !norm(r.reference).includes(norm(c.declaredReference)) && !norm(c.declaredReference).includes(norm(r.reference)))
    f.push({ code: "reference_differs", level: "warn", label: "Reference on the receipt differs from the declared reference", detail: `Receipt ${r.reference} · declared ${c.declaredReference}.` });

  if (r.confidence === "low" || r.legible === false) f.push({ code: "unclear_receipt", level: "warn", label: "The receipt is hard to read", detail: "Ask for a clearer copy or the bank's PDF receipt." });
  if (!r.looksLikePaymentProof) f.push({ code: "not_a_receipt", level: "warn", label: "This may not be a payment receipt" });
  if (r.inconsistencies?.length) f.push({ code: "visual_inconsistency", level: "warn", label: "Possible visual inconsistencies noticed", detail: `${r.inconsistencies.join("; ")}. These are only prompts for a human look and are not evidence of tampering.` });

  const missing = [r.amountNaira === null && "amount", !r.date && "date", !norm(r.reference) && "reference", !r.transactionStatus && "status", !r.bank && "bank"].filter(Boolean) as string[];
  if (missing.length >= 2) f.push({ code: "incomplete", level: "warn", label: "The receipt looks incomplete", detail: `Not visible: ${missing.join(", ")}.` });
  if (r.transactionStatus && !/succe|complete|paid|approved|posted/i.test(r.transactionStatus)) f.push({ code: "status_not_success", level: "alert", label: "The receipt does not show a successful status", detail: `Status shown: ${r.transactionStatus}.` });

  if (r.date) {
    const d = new Date(r.date + "T12:00:00Z");
    const periodStart = new Date(Date.UTC(c.year, c.month - 1, 1)), latest = new Date(Date.UTC(c.year, c.month + 1, 1)); // payment may fall in the month or the next
    if (d < periodStart || d >= latest) f.push({ code: "date_period", level: "warn", label: "Transaction date is outside the reporting period", detail: `Receipt date ${r.date}; period ${monthName(c.month)} ${c.year}.` });
    const gap = Math.abs(d.getTime() - c.declaredPaidAt.getTime()) / 86_400_000;
    if (gap > 1.5) f.push({ code: "date_mismatch", level: "warn", label: "Receipt date differs from the declared payment date", detail: `Receipt ${r.date}; declared ${c.declaredPaidAt.toISOString().slice(0, 10)}.` });
  }
  return f;
}
