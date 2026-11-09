/** What can be exported, who may export it, and which filters apply. Client-safe: the server re-checks everything. */
import { PERMS } from "../rbac";
import type { Format } from "./doc";

export type FilterKey = "year" | "month" | "zone" | "area" | "parish" | "status" | "kind" | "event" | "from" | "to" | "level" | "category" | "leaders" | "session";
export type ExportType = "parish_monthly" | "area_monthly" | "zone_monthly" | "provincial" | "reconciliation" | "confirmed_payments" | "outstanding_payments" | "attendance" | "event_registrations" | "members" | "leadership";
export type ExportDef = { key: ExportType; group: string; label: string; help: string; formats: Format[]; filters: FilterKey[]; roles: readonly string[]; contact?: boolean };

const PROV = ["super_admin", "provincial_admin", "finance_admin", "auditor"] as const;
export const EXPORTS: ExportDef[] = [
  { key: "parish_monthly", group: "Monthly reports", label: "Parish monthly reports", help: "Each parish's submitted report with administrator, activity answers and payment verification status.", formats: ["pdf", "xlsx", "csv"], filters: ["year", "month", "zone", "area", "parish", "status"], roles: PERMS.reports, contact: true },
  { key: "area_monthly", group: "Monthly reports", label: "Area monthly reports", help: "Area reports with the parish submission summary behind each.", formats: ["pdf", "xlsx", "csv"], filters: ["year", "month", "zone", "area", "status"], roles: PERMS.reports, contact: true },
  { key: "zone_monthly", group: "Monthly reports", label: "Zonal monthly reports", help: "Zonal reports with their area and parish summaries.", formats: ["pdf", "xlsx", "csv"], filters: ["year", "month", "zone", "status"], roles: PERMS.reports, contact: true },
  { key: "provincial", group: "Monthly reports", label: "Provincial consolidated report", help: "Province-wide submissions, money and zonal reports for one period.", formats: ["pdf", "xlsx", "csv"], filters: ["year", "month"], roles: PROV },
  { key: "reconciliation", group: "Finance", label: "Financial reconciliation", help: "Declared vs confirmed vs pending, with arithmetic checks and any variance.", formats: ["pdf", "xlsx", "csv"], filters: ["year", "month", "zone", "area"], roles: PERMS.finance },
  { key: "confirmed_payments", group: "Finance", label: "Confirmed payments", help: "Only money finance has verified, plus audited adjustments.", formats: ["pdf", "xlsx", "csv"], filters: ["year", "month", "zone", "area", "parish", "kind"], roles: PERMS.finance },
  { key: "outstanding_payments", group: "Finance", label: "Outstanding payments", help: "Youth Sunday balances not yet covered by confirmed money.", formats: ["pdf", "xlsx", "csv"], filters: ["year", "month", "zone", "area", "parish"], roles: PERMS.finance },
  { key: "attendance", group: "People and events", label: "Attendance", help: "Attendance sessions with totals by zone, area and parish.", formats: ["pdf", "xlsx", "csv"], filters: ["from", "to", "kind", "event", "zone", "area", "parish"], roles: PERMS.attendanceView },
  { key: "event_registrations", group: "People and events", label: "Event registrations", help: "Attendee list for one event.", formats: ["pdf", "xlsx", "csv"], filters: ["event", "zone", "area", "parish"], roles: PERMS.attendanceView },
  { key: "members", group: "People and events", label: "Members", help: "Member register. Minors' contact details are protected as on screen.", formats: ["pdf", "xlsx", "csv"], filters: ["zone", "area", "parish", "status", "category", "leaders"], roles: PERMS.members },
  { key: "leadership", group: "People and events", label: "Leadership", help: "Current appointments and committees at the levels you can see.", formats: ["pdf", "xlsx", "csv"], filters: ["level", "zone", "area", "parish", "status"], roles: PERMS.governance },
];
export const EXPORT_BY_KEY = Object.fromEntries(EXPORTS.map((e) => [e.key, e])) as Record<ExportType, ExportDef>;
export const isExportType = (k: string): k is ExportType => k in EXPORT_BY_KEY;
export const exportsFor = (role: string) => EXPORTS.filter((e) => e.roles.includes(role));
