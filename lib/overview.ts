/**
 * Organisation dashboards (parish / area / zone / province). Pure: takes rows, returns figures.
 * Money is read ONLY from parish Youth Sunday obligations, once each. Area and zone figures are sums of their parishes,
 * never of area/zone report roll-ups, so nothing is counted twice.
 */
import { PROBLEM_STATUSES, FV_LABEL, obligationFv, totals, type FvStatus } from "./verification";

export type Level = "province" | "zone" | "area" | "parish";
const id = (v: any) => (v ? String(v) : "");

export type PRow = {
  id: string; name: string; zone: string; zoneName: string; area: string; areaName: string;
  reportStatus: string; reportId: string | null; fv: FvStatus; fvLabel: string;
  requiredKobo: number; confirmedKobo: number; outstandingKobo: number; declaredKobo: number; hasRemittance: boolean;
  checkIns: number;
};
const SUBMITTED = ["submitted", "completed", "revision_requested", "incomplete"];
export const reportDone = (s: string) => SUBMITTED.includes(s);

export type Input = {
  parishes: any[]; areas: any[]; zones: any[];
  remittances: any[]; // kind yst, this period
  reports: any[]; // all types, this period
  attendance: any[]; // check-ins in the period (already scoped)
  sessions: any[]; // sessions in the period (already scoped)
};

export function parishRows(i: Input): PRow[] {
  const zn = new Map(i.zones.map((z) => [id(z._id), z.name])), an = new Map(i.areas.map((a) => [id(a._id), a.name]));
  const rem = new Map(i.remittances.filter((r) => r.kind === "yst").map((r) => [id(r.parish), r]));
  const rep = new Map(i.reports.filter((r) => r.type === "parish").map((r) => [id(r.parish), r]));
  const ci = new Map<string, number>();
  for (const a of i.attendance) ci.set(id(a.parish), (ci.get(id(a.parish)) ?? 0) + 1);
  return i.parishes.map((p) => {
    const m = rem.get(id(p._id)), r = rep.get(id(p._id)), t = totals(m), fv = obligationFv(m);
    return {
      id: id(p._id), name: p.name, zone: id(p.zone), zoneName: zn.get(id(p.zone)) ?? "", area: id(p.area), areaName: p.area ? an.get(id(p.area)) ?? "" : "",
      reportStatus: r?.status ?? "not_started", reportId: r?.reportId ?? null, fv, fvLabel: FV_LABEL[fv],
      requiredKobo: t.requiredKobo, confirmedKobo: t.confirmedKobo, outstandingKobo: m ? t.outstandingKobo : 0, declaredKobo: t.declaredKobo, hasRemittance: !!m, checkIns: ci.get(id(p._id)) ?? 0,
    };
  });
}

export function sumRows(rows: PRow[]) {
  const by: Record<string, number> = {};
  rows.forEach((r) => (by[r.fv] = (by[r.fv] ?? 0) + 1));
  const submitted = rows.filter((r) => reportDone(r.reportStatus)).length;
  const withRem = rows.filter((r) => r.hasRemittance);
  const confirmedParishes = rows.filter((r) => r.hasRemittance && r.fv === "confirmed").length;
  return {
    parishes: rows.length, reportsSubmitted: submitted, reportsOutstanding: rows.length - submitted,
    remittancesSubmitted: withRem.length, remittancesMissing: rows.length - withRem.length,
    expectedKobo: withRem.reduce((n, r) => n + r.requiredKobo, 0), confirmedKobo: rows.reduce((n, r) => n + r.confirmedKobo, 0), outstandingKobo: rows.reduce((n, r) => n + r.outstandingKobo, 0),
    declaredKobo: rows.reduce((n, r) => n + r.declaredKobo, 0),
    fvConfirmed: confirmedParishes, fvPending: withRem.filter((r) => ["submitted", "receipt_uploaded", "ai_examined", "awaiting_verification"].includes(r.fv)).length,
    fvProblem: withRem.filter((r) => PROBLEM_STATUSES.includes(r.fv)).length, fvPartial: withRem.filter((r) => r.fv === "partially_confirmed").length,
    fvPct: withRem.length ? Math.round((confirmedParishes / withRem.length) * 100) : 0, fvByStatus: by,
    checkIns: rows.reduce((n, r) => n + r.checkIns, 0),
  };
}

export function attendanceStats(att: any[], sessions: any[]) {
  const people = new Set(att.map((a) => a.phoneKey));
  return { checkIns: att.length, unique: people.size, visitors: att.filter((a) => a.visitor).length, members: att.filter((a) => !a.visitor).length, sessions: sessions.length, qr: att.filter((a) => a.method === "qr").length };
}

/** What the parish still has to do. */
export function requirements(row: PRow, hasRemittanceDoc: any) {
  const out: { text: string; href: string; level: "warn" | "bad" }[] = [];
  if (row.reportStatus === "not_started" || row.reportStatus === "draft") out.push({ text: row.reportStatus === "draft" ? "Finish and submit your monthly report (saved as a draft)" : "Submit your monthly report", href: "/admin/reports/new", level: "warn" });
  if (row.reportStatus === "revision_requested") out.push({ text: "Your report needs revision. See the reviewer's note", href: "/admin/reports", level: "bad" });
  if (row.reportStatus === "incomplete") out.push({ text: "Your report was marked incomplete. Revise and resubmit", href: "/admin/reports", level: "bad" });
  if (!row.hasRemittance) out.push({ text: "Submit your Youth Sunday remittance with the payment receipt", href: "/admin/reports/new", level: "warn" });
  else if (PROBLEM_STATUSES.includes(row.fv)) out.push({ text: `Payment issue: ${row.fvLabel}. Respond or resubmit evidence`, href: "/admin/finance", level: "bad" });
  else if (row.outstandingKobo > 0 && row.fv !== "awaiting_verification" && !["submitted", "receipt_uploaded", "ai_examined"].includes(row.fv)) out.push({ text: "Balance still outstanding. Add a payment", href: "/admin/finance", level: "warn" });
  void hasRemittanceDoc;
  return out;
}

export function groupChildren(level: Level, rows: PRow[], areas: any[], zones: any[], areaReports: any[]) {
  if (level === "province") {
    return zones.map((z) => {
      const rs = rows.filter((r) => r.zone === id(z._id));
      return { kind: "zone" as const, id: id(z._id), name: z.name, areas: areas.filter((a) => id(a.zone) === id(z._id)).length, direct: rs.filter((r) => !r.area).length, ...sumRows(rs) };
    });
  }
  if (level === "zone") {
    const out: any[] = areas.map((a) => {
      const rs = rows.filter((r) => r.area === id(a._id));
      const ar = areaReports.find((x) => id(x.area) === id(a._id));
      return { kind: "area", id: id(a._id), name: a.name, areaReport: ar?.status ?? "not_started", ...sumRows(rs) };
    });
    const direct = rows.filter((r) => !r.area);
    return [...out, ...direct.map((r) => ({ kind: "parish", id: r.id, name: r.name, note: "Directly attached", ...sumRows([r]), reportStatus: r.reportStatus, fv: r.fv, fvLabel: r.fvLabel }))];
  }
  return rows.map((r) => ({ kind: "parish", id: r.id, name: r.name, ...sumRows([r]), reportStatus: r.reportStatus, fv: r.fv, fvLabel: r.fvLabel }));
}
