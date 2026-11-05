/**
 * Client-safe rules for money verification, report status and overall compliance.
 * The two status systems are independent: a report never waits for payment verification, and a payment
 * discrepancy never invalidates a submitted report.
 */

// ---------- Financial verification ----------
export const PAYMENT_STATUSES = ["submitted", "awaiting_verification", "confirmed", "payment_not_found", "amount_mismatch", "rejected", "resubmission_required"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
/** Decisions that need the parish to respond. */
export const PROBLEM_STATUSES: readonly string[] = ["payment_not_found", "amount_mismatch", "rejected", "resubmission_required"];

export type FvStatus = "awaiting_evidence" | "receipt_uploaded" | "ai_examined" | "awaiting_verification" | "confirmed" | "partially_confirmed" | "payment_not_found" | "amount_mismatch" | "rejected" | "resubmission_required";

export const FV_LABEL: Record<FvStatus, string> = {
  awaiting_evidence: "Awaiting payment evidence",
  receipt_uploaded: "Receipt uploaded",
  ai_examined: "AI examination completed",
  awaiting_verification: "Awaiting finance verification",
  confirmed: "Confirmed",
  partially_confirmed: "Part-paid, balance outstanding",
  payment_not_found: "Payment not found",
  amount_mismatch: "Amount mismatch",
  rejected: "Rejected",
  resubmission_required: "Resubmission required",
};
export const FV_BADGE: Record<FvStatus, string> = {
  awaiting_evidence: "badge badge-warn", receipt_uploaded: "badge", ai_examined: "badge", awaiting_verification: "badge badge-warn",
  confirmed: "badge badge-ok", partially_confirmed: "badge badge-warn", payment_not_found: "badge badge-bad", amount_mismatch: "badge badge-bad", rejected: "badge badge-bad", resubmission_required: "badge badge-warn",
};

type Pay = { status: string; confirmedKobo?: number | null; amountKobo?: number; analysis?: unknown };
type Obligation = Pay & { requiredKobo?: number | null; payments?: Pay[]; adjustments?: { amountKobo: number }[] };

/** Status of a single payment (the original one or any additional one). */
export function paymentFv(p: Pay): FvStatus {
  if (p.status === "submitted") return p.analysis ? "ai_examined" : "receipt_uploaded";
  return p.status as FvStatus;
}

/** Totals for one Youth Sunday obligation. Only confirmed money and audited adjustments count. */
export function totals(r: Obligation | null | undefined) {
  if (!r) return { requiredKobo: 0, confirmedKobo: 0, declaredKobo: 0, outstandingKobo: 0, overpaidKobo: 0, satisfied: false };
  const all: Pay[] = [r, ...(r.payments ?? [])];
  const confirmedKobo = all.reduce((n, p) => n + (p.status === "confirmed" ? p.confirmedKobo ?? 0 : 0), 0) + (r.adjustments ?? []).reduce((n, a) => n + a.amountKobo, 0);
  const declaredKobo = all.reduce((n, p) => n + (p.amountKobo ?? 0), 0);
  const requiredKobo = r.requiredKobo ?? 0;
  return {
    requiredKobo, confirmedKobo, declaredKobo,
    outstandingKobo: Math.max(0, requiredKobo - confirmedKobo),
    overpaidKobo: Math.max(0, confirmedKobo - requiredKobo),
    // An obligation is paid only when confirmed money covers it. Pending, rejected or unverified evidence never does.
    satisfied: confirmedKobo >= requiredKobo,
  };
}

/** The status shown for the whole obligation. */
export function obligationFv(r: Obligation | null | undefined): FvStatus {
  if (!r) return "awaiting_evidence";
  const t = totals(r);
  if (t.satisfied) return "confirmed";
  const all: Pay[] = [r, ...(r.payments ?? [])];
  const problem = all.find((p) => PROBLEM_STATUSES.includes(p.status));
  if (problem) return problem.status as FvStatus;
  const pending = all.filter((p) => p.status === "submitted" || p.status === "awaiting_verification");
  if (pending.some((p) => p.status === "awaiting_verification")) return "awaiting_verification";
  if (pending.length) return paymentFv(pending[0]);
  return t.confirmedKobo > 0 ? "partially_confirmed" : "awaiting_evidence";
}

// ---------- Monthly report status ----------
export const REPORT_STATUSES = ["draft", "submitted", "completed", "revision_requested", "incomplete"] as const;
export type ReportStatus = "not_started" | (typeof REPORT_STATUSES)[number];
export const REPORT_LABEL: Record<ReportStatus, string> = { not_started: "Not started", draft: "Draft", submitted: "Submitted", completed: "Completed", revision_requested: "Revision requested", incomplete: "Incomplete" };
export const REPORT_BADGE: Record<ReportStatus, string> = { not_started: "badge", draft: "badge", submitted: "badge badge-ok", completed: "badge badge-ok", revision_requested: "badge badge-warn", incomplete: "badge badge-bad" };

// ---------- Overall compliance ----------
export type Compliance = { code: string; label: string; level: "ok" | "warn" | "bad" | "none"; detail?: string };

/** Derived from the two independent statuses. Fully compliant only when the report is in AND the remittance is financially confirmed. */
export function compliance(report: ReportStatus, rem: Obligation | null | undefined): Compliance {
  const fv = obligationFv(rem);
  const settled = !!rem && totals(rem).satisfied;
  const tail = settled ? undefined : `Payment: ${FV_LABEL[fv].toLowerCase()}.`;
  if (report === "revision_requested") return { code: "revision_requested", label: "Revision Requested", level: "warn", detail: tail };
  if (report === "submitted" || report === "completed") {
    if (settled) return { code: "fully_compliant", label: "Fully Compliant", level: "ok" };
    if (PROBLEM_STATUSES.includes(fv)) return { code: "submitted_discrepancy", label: "Report Submitted — Payment Discrepancy Flagged", level: "bad", detail: tail };
    return { code: "submitted_pending", label: "Report Submitted — Financial Verification Pending", level: "warn", detail: tail };
  }
  if (report === "incomplete") return { code: "incomplete_activity", label: "Report Incomplete — Activity Information Missing", level: "bad", detail: tail };
  // not started or only a draft
  if (rem) return { code: "incomplete_activity", label: "Report Incomplete — Activity Information Missing", level: "bad", detail: tail };
  if (report === "draft") return { code: "incomplete_financial", label: "Report Incomplete — Financial Verification Outstanding", level: "bad", detail: "No payment information has been submitted yet." };
  return { code: "not_submitted", label: "Not Submitted", level: "none" };
}
export const COMPLIANCE_BADGE = { ok: "badge badge-ok", warn: "badge badge-warn", bad: "badge badge-bad", none: "badge" } as const;
