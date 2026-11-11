import { FV_LABEL, REPORT_LABEL, compliance, type FvStatus, type ReportStatus, type Compliance } from "./verification";

/** One place that decides how a status looks. The icon+label always carry the meaning, never colour alone. */
export type Level = "ok" | "warn" | "bad" | "info" | "none";
export type StatusView = { label: string; level: Level };

const FV_LEVEL: Record<FvStatus, Level> = {
  awaiting_evidence: "warn", receipt_uploaded: "info", ai_examined: "info", awaiting_verification: "warn", confirmed: "ok",
  partially_confirmed: "warn", payment_not_found: "bad", amount_mismatch: "bad", rejected: "bad", resubmission_required: "warn",
};
const REPORT_LEVEL: Record<ReportStatus, Level> = { not_started: "none", draft: "none", submitted: "ok", completed: "ok", revision_requested: "warn", incomplete: "bad" };

export function financeStatus(s: string): StatusView {
  const k = s as FvStatus;
  return k in FV_LABEL ? { label: FV_LABEL[k], level: FV_LEVEL[k] } : { label: s || "Unknown", level: "none" };
}
export function reportStatus(s: string): StatusView {
  const k = s as ReportStatus;
  return k in REPORT_LABEL ? { label: REPORT_LABEL[k], level: REPORT_LEVEL[k] } : { label: s || "Unknown", level: "none" };
}
export function complianceStatus(c: Compliance): StatusView { return { label: c.label, level: c.level }; }
export { compliance };

/** Deadline-based state for a monthly submission. */
export function timelinessStatus(s: string): StatusView {
  switch (s) {
    case "on_time": return { label: "On time", level: "ok" };
    case "late": return { label: "Late", level: "warn" };
    case "overdue": return { label: "Overdue", level: "bad" };
    case "not_submitted": return { label: "Not submitted", level: "none" };
    default: return { label: s || "Unknown", level: "none" };
  }
}
