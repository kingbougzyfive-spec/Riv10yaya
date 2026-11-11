import { CheckCircle2, Clock, AlertTriangle, XCircle, Info, Circle } from "lucide-react";
import { complianceStatus, financeStatus, reportStatus, timelinessStatus, type Level, type StatusView } from "@/lib/status";
import type { Compliance } from "@/lib/verification";

const ICON = { ok: CheckCircle2, warn: Clock, bad: XCircle, info: Info, none: Circle } as const;
const CLS: Record<Level, string> = { ok: "badge badge-ok", warn: "badge badge-warn", bad: "badge badge-bad", info: "badge", none: "badge" };

/** Icon + text + colour, so status never depends on colour alone. */
export function StatusBadge({ view }: { view: StatusView }) {
  const I = view.level === "warn" && /mismatch|not found|rejected/i.test(view.label) ? AlertTriangle : ICON[view.level];
  return <span className={CLS[view.level]}><I className="h-3 w-3 shrink-0" aria-hidden />{view.label}</span>;
}
export const FinanceBadge = ({ status }: { status: string }) => <StatusBadge view={financeStatus(status)} />;
export const ReportBadge = ({ status }: { status: string }) => <StatusBadge view={reportStatus(status)} />;
export const ComplianceBadge = ({ value }: { value: Compliance }) => <StatusBadge view={complianceStatus(value)} />;
export const TimelinessBadge = ({ status }: { status: string }) => <StatusBadge view={timelinessStatus(status)} />;
