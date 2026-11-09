/**
 * Pure builders: scoped database rows in, an official ReportDoc out. No database, no network.
 * Anything confidential is decided here from explicit flags (canContact, restricted), never from the UI.
 */
import { dashboard, parishesInScope, recordsFor } from "../finance-dash";
import { MONTHS } from "../money";
import { FIELDS } from "../report-config";
import { paymentsOf, type Names } from "../sheet-rows";
import { FV_LABEL, REPORT_LABEL, obligationFv, totals } from "../verification";
import type { Block, Cell, Col, ReportDoc } from "./doc";
import { safeFile } from "./doc";

export type Base = { org: string; preparedBy: string; scope: string; filters: string[]; now: Date; canContact: boolean };
const id = (v: any) => (v ? String(v) : "");
const nz = (k?: number | null) => Number(((k ?? 0) / 100).toFixed(2));
const sum = (a: number[]) => a.reduce((s, x) => s + x, 0);
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0);
export const periodText = (month: number, year: number) => (month ? `${MONTHS[month - 1]} ${year}` : `January to December ${year}`);
const lagos = (d?: Date | string | null) => (d ? new Date(new Date(d).getTime() + 3600_000).toISOString().slice(0, 16).replace("T", " ") : "");
const lagosDay = (d?: Date | string | null) => lagos(d).slice(0, 10);
const NOTE_NGN = "All amounts are in Nigerian naira (NGN).";
const VERIFY_STD = "Only payments confirmed by finance are counted as received. Pending verification, needs-action and rejected payments are shown separately and are not received money.";
const M = (h: string): Col => ({ h, kind: "money" });
const I = (h: string): Col => ({ h, kind: "int" });
const loc = (r: any, n: Names) => [n.zone.get(id(r.zone)) ?? "", r.area ? n.area.get(id(r.area)) ?? "" : "", r.parish ? n.parish.get(id(r.parish)) ?? "" : ""];
const cmp = (...f: ((a: any) => string)[]) => (a: any, b: any) => { for (const g of f) { const c = g(a).localeCompare(g(b)); if (c) return c; } return 0; };

function mk(b: Base, o: { file: string; title: string; period: string; blocks: Block[]; verification?: string; administrator?: string; notes?: string[]; csv?: boolean; confidential?: boolean }): ReportDoc {
  const hasTable = o.blocks.some((x) => x.t === "table" && x.csv !== false);
  return { file: safeFile(o.file), title: o.title, org: b.org, period: o.period, generatedAt: b.now, preparedBy: b.preparedBy, scope: b.scope, filters: b.filters, verification: o.verification, administrator: o.administrator, notes: o.notes, blocks: o.blocks, formats: hasTable ? ["pdf", "xlsx", "csv"] : ["pdf", "xlsx"], confidential: o.confidential ?? true };
}

// ------------------------------------------------------------------ monthly reports (parish / area / zone)
export type MonthlyIn = { level: "parish" | "area" | "zone"; reports: any[]; rems: any[]; names: Names; year: number; month: number; contactFor: (r: any) => boolean };
export const DETAIL_CAP = 60;
export function monthlyDoc(b: Base, i: MonthlyIn): ReportDoc {
  const { level, names: n } = i;
  const rm = new Map<string, any>(i.rems.map((r) => [id(r._id), r]));
  const rows = [...i.reports].sort(cmp((r) => n.zone.get(id(r.zone)) ?? "", (r) => (r.area ? n.area.get(id(r.area)) ?? "" : ""), (r) => (r.parish ? n.parish.get(id(r.parish)) ?? "" : ""), (r) => `${r.year}-${String(r.month).padStart(2, "0")}`));
  const showContact = b.canContact;
  const fvOf = (r: any) => { const m = r.remittance ? rm.get(id(r.remittance)) : null; return m ? FV_LABEL[obligationFv(m)] : "No remittance recorded"; };
  const label = level === "parish" ? "Parish" : level === "area" ? "Area" : "Zonal";
  const rollupCols: Col[] = level === "parish" ? [] : level === "area" ? [I("Parishes"), I("Parish reports submitted"), I("Parish reports outstanding")] : [I("Areas"), I("Area reports submitted"), I("Parishes"), I("Parish reports submitted")];
  const rollupVals = (r: any): Cell[] => { const u = r.rollup ?? {}; return level === "parish" ? [] : level === "area" ? [u.parishCount ?? "", u.submittedParishReports ?? "", u.outstandingParishReports ?? ""] : [u.areaCount ?? "", u.submittedAreaReports ?? "", u.totalParishes ?? "", u.submittedParishReports ?? ""]; };
  const finCols: Col[] = level === "parish" ? [{ h: "Payment verification" }, M("Offering (NGN)"), M("Required (NGN)"), M("Confirmed (NGN)"), M("Outstanding (NGN)")] : [];
  const finVals = (r: any): Cell[] => { if (level !== "parish") return []; const m = r.remittance ? rm.get(id(r.remittance)) : null; if (!m) return ["No remittance recorded", "", "", "", ""]; const t = totals(m); return [FV_LABEL[obligationFv(m)], nz(m.offeringKobo), nz(t.requiredKobo), nz(t.confirmedKobo), nz(t.outstandingKobo)]; };
  const cols: Col[] = [{ h: "Zone" }, ...(level !== "zone" ? [{ h: "Area" }] : []), ...(level === "parish" ? [{ h: "Parish", w: 1.3 }] : []), { h: "Period", kind: "center" }, { h: "Submitted on" }, { h: "Report status" }, ...(showContact ? [{ h: "Administrator", w: 1.2 }, { h: "Phone" }] : []), ...rollupCols, ...finCols];
  const body: Cell[][] = rows.map((r) => { const [z, a, p] = loc(r, n); return [z, ...(level !== "zone" ? [a] : []), ...(level === "parish" ? [p] : []), `${MONTHS[r.month - 1].slice(0, 3)} ${r.year}`, lagos(r.submittedAt), REPORT_LABEL[(r.status ?? "submitted") as keyof typeof REPORT_LABEL] ?? r.status, ...(showContact ? [r.contact?.fullName ?? "", r.contact?.phone ?? ""] : []), ...rollupVals(r), ...finVals(r)]; });
  const byStatus = new Map<string, number>(); rows.forEach((r) => byStatus.set(r.status, (byStatus.get(r.status) ?? 0) + 1));
  const blocks: Block[] = [{ t: "kv", title: "Summary", items: [{ k: `${label} reports`, v: String(rows.length) }, ...[...byStatus].map(([s, c]) => ({ k: REPORT_LABEL[s as keyof typeof REPORT_LABEL] ?? s, v: String(c) }))] }, { t: "table", title: `${label} report submissions`, sheet: "Submissions", cols, rows: body, empty: "No reports match these filters." }];
  // Excel: every activity answer in one grid. PDF: each report on its own pages.
  const fields = FIELDS[level];
  blocks.push({ t: "table", only: "xlsx", title: "Activity answers", sheet: "Activity answers", csv: false, cols: [{ h: "Zone" }, ...(level !== "zone" ? [{ h: "Area" }] : []), ...(level === "parish" ? [{ h: "Parish" }] : []), { h: "Period" }, ...fields.map((f) => ({ h: f.label, kind: (f.kind === "int" ? "int" : "text") as Col["kind"], w: f.kind === "int" ? 1 : 2 })) ], rows: rows.map((r) => { const [z, a, p] = loc(r, n); return [z, ...(level !== "zone" ? [a] : []), ...(level === "parish" ? [p] : []), `${MONTHS[r.month - 1]} ${r.year}`, ...fields.map((f) => { const v = r.activity?.[f.key]; return v === undefined || v === null || v === "" ? "" : f.kind === "int" ? Number(v) : String(v).slice(0, 3000); })]; }) });
  rows.slice(0, DETAIL_CAP).forEach((r) => {
    const [z, a, p] = loc(r, n); const who = [p, level === "area" ? a : "", z].filter(Boolean);
    const allowed = i.contactFor(r);
    blocks.push({ t: "break", only: "pdf" });
    blocks.push({ t: "kv", only: "pdf", title: `${label} report: ${who.join(", ")}: ${MONTHS[r.month - 1]} ${r.year}`, items: [{ k: "Status", v: REPORT_LABEL[(r.status ?? "submitted") as keyof typeof REPORT_LABEL] ?? r.status }, { k: "Submitted on", v: lagos(r.submittedAt) }, ...(allowed ? [{ k: "Administrator", v: r.contact?.fullName || "-" }, { k: "Phone", v: [r.contact?.phone, r.contact?.altPhone].filter(Boolean).join(" / ") || "-" }] : []), ...(level === "parish" ? [{ k: "Payment verification", v: fvOf(r) }] : []), ...(r.revision > 1 ? [{ k: "Revision", v: String(r.revision) }] : [])] });
    blocks.push({ t: "text", only: "pdf", paragraphs: fields.map((f) => ({ label: f.label, text: r.activity?.[f.key] === undefined || r.activity?.[f.key] === "" ? "-" : String(r.activity[f.key]) })) });
  });
  const notes = [NOTE_NGN, ...(rows.length > DETAIL_CAP ? [`The PDF has full pages for the first ${DETAIL_CAP} of ${rows.length} reports. The Excel file contains every report.`] : []), ...(showContact ? [] : ["Administrator names and phone numbers are not included for your role."])];
  const verification = level === "parish" ? (rows.length ? [...new Set(rows.map(fvOf))].map((l) => `${rows.filter((r) => fvOf(r) === l).length} ${l}`).join("; ") : "No reports in this selection") + ". " + VERIFY_STD : "Not applicable: area and zonal reports carry no payments. See the Confirmed Payments report.";
  const adminLine = rows.length === 1 && i.contactFor(rows[0]) && showContact ? [rows[0].contact?.fullName, rows[0].contact?.phone].filter(Boolean).join(", ") : rows.length > 1 && showContact ? "Each report lists its own administrator and phone number" : undefined;
  return mk(b, { file: `${level}-monthly-reports-${i.year}-${i.month || "all"}`, title: `${label} Monthly Reports`, period: periodText(i.month, i.year), blocks, verification, administrator: adminLine, notes });
}

// ------------------------------------------------------------------ provincial consolidated
export type ProvIn = { parishes: any[]; zones: any[]; areas: any[]; rems: any[]; reports: any[]; names: Names; year: number; month: number };
export function provincialDoc(b: Base, i: ProvIn): ReportDoc {
  const f = { year: i.year, month: i.month };
  const dash = dashboard({ rows: i.rems, parishes: i.parishes, zones: i.zones, areas: i.areas, filter: f });
  const pr = parishesInScope(i.parishes, f);
  const pRep = i.reports.filter((r) => r.type === "parish" && r.status !== "draft" && r.year === i.year && (!i.month || r.month === i.month));
  const done = new Set(pRep.map((r) => id(r.parish)));
  const zoneRows = i.zones.filter((z) => z.active !== false || pr.some((p) => id(p.zone) === id(z._id))).map((z) => {
    const ps = pr.filter((p) => id(p.zone) === id(z._id)); const sub = ps.filter((p) => done.has(id(p._id))).length;
    const d: any = dash.byZone.find((x) => x.id === id(z._id)) ?? {};
    return { name: z.name as string, parishes: ps.length, sub, d };
  }).filter((x) => x.parishes || x.d.expected || x.d.confirmed).sort((x, y) => x.name.localeCompare(y.name));
  const body: Cell[][] = zoneRows.map((z) => [z.name, z.parishes, z.sub, z.parishes - z.sub, pct(z.sub, z.parishes), nz(z.d.expected), nz(z.d.confirmed), nz(z.d.outstanding), nz(z.d.pending), nz(z.d.flagged), nz(z.d.rejected)]);
  const T = (k: number) => sum(body.map((r) => Number(r[k]) || 0));
  const totalRow: Cell[] = ["Province", T(1), T(2), T(3), pct(T(2), T(1)), ...[5, 6, 7, 8, 9, 10].map((k) => Number(T(k).toFixed(2)))];
  const c = dash.cards;
  const zrep = i.reports.filter((r) => r.type === "zone" && r.status !== "draft" && r.year === i.year && (!i.month || r.month === i.month)).sort(cmp((r) => i.names.zone.get(id(r.zone)) ?? ""));
  const blocks: Block[] = [
    { t: "kv", title: "Province at a glance", items: [{ k: "Parishes", v: String(pr.length) }, { k: "Reports submitted", v: `${done.size} (${pct(done.size, pr.length)}%)` }, { k: "Confirmed received (Youth Sunday)", v: ngn(c.confirmed) }, { k: "Required (Youth Sunday)", v: ngn(c.expected) }, { k: "Outstanding", v: ngn(c.outstanding) }, { k: "Pending verification", v: ngn(c.pending) }] },
    { t: "table", title: "Submissions and money by zone", sheet: "By zone", cols: [{ h: "Zone", w: 1.4 }, I("Parishes"), I("Reports submitted"), I("Reports missing"), { h: "Submission rate", kind: "pct" }, M("Required (NGN)"), M("Confirmed (NGN)"), M("Outstanding (NGN)"), M("Pending verification (NGN)"), M("Needs parish action (NGN)"), M("Rejected (NGN)")], rows: body, totals: totalRow },
    { t: "table", title: "Zonal reports", sheet: "Zonal reports", csv: false, cols: [{ h: "Zone" }, { h: "Report status" }, { h: "Submitted on" }, ...(b.canContact ? [{ h: "Administrator" }, { h: "Phone" }] : [])], rows: zrep.map((r) => [i.names.zone.get(id(r.zone)) ?? "", REPORT_LABEL[(r.status ?? "submitted") as keyof typeof REPORT_LABEL] ?? r.status, lagos(r.submittedAt), ...(b.canContact ? [r.contact?.fullName ?? "", r.contact?.phone ?? ""] : [])]), empty: "No zonal reports submitted for this period." },
    { t: "text", only: "pdf", title: "Zonal highlights", paragraphs: zrep.flatMap((r) => ["achievements", "challenges", "recommendations"].filter((k) => r.activity?.[k] && !/^(nil|none|n\/a)\.?$/i.test(String(r.activity[k]).trim())).map((k) => ({ label: `${i.names.zone.get(id(r.zone)) ?? ""}: ${FIELDS.zone.find((x) => x.key === k)?.label ?? k}`, text: String(r.activity[k]).slice(0, 900) }))) },
  ];
  return mk(b, { file: `provincial-consolidated-${i.year}-${i.month || "all"}`, title: "Provincial Consolidated Report", period: periodText(i.month, i.year), blocks, verification: VERIFY_STD, notes: [NOTE_NGN, "Money columns cover Youth Sunday remittances by reporting period. Levies and contributions are in the Financial reconciliation report."] });
}
const ngn = (k: number) => "NGN " + (k / 100).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ------------------------------------------------------------------ finance
export type FinIn = { rems: any[]; parishes: any[]; zones: any[]; areas: any[]; year: number; month: number; zone?: string; area?: string; parish?: string; kind?: string };
export function reconciliationDoc(b: Base, i: FinIn): ReportDoc {
  const input = { rows: i.rems, parishes: i.parishes, zones: i.zones, areas: i.areas, filter: { year: i.year, month: i.month, zone: i.zone, area: i.area } };
  const d = dashboard(input), r = d.reconciliation;
  const checks: [string, number, number, string][] = [
    ["Every declared amount sits in exactly one status", r.declaredTotal, r.partitionSum, "Declared total vs confirmed + pending + needs action + rejected"],
    ["Confirmed amount declared matches confirmed amount received", r.confirmedDeclared, r.confirmedReceived, "Differences arise when finance confirms a different amount than was declared"],
    ["Youth Sunday: required minus confirmed equals outstanding minus overpaid", r.yst.required - r.yst.confirmed, r.yst.outstanding - r.yst.overpaid, "Arithmetic check on Youth Sunday obligations"],
    ["Headline confirmed figure equals confirmed Youth Sunday money", d.cards.confirmed, r.yst.confirmed, "Levies and contributions are shown apart"],
  ];
  const failed = checks.filter(([, a, c]) => a !== c).length;
  const recs = recordsFor("variance", input, (m) => MONTHS[m - 1]);
  const bz = d.byZone.map((z: any) => [z.name, nz(z.expected), nz(z.confirmed), nz(z.outstanding), nz(z.pending), nz(z.flagged), nz(z.rejected), nz(z.leviesConfirmed), nz(z.contributionsConfirmed)] as Cell[]).sort((x, y) => String(x[0]).localeCompare(String(y[0])));
  const tot = (k: number) => Number(sum(bz.map((x) => Number(x[k]) || 0)).toFixed(2));
  const blocks: Block[] = [
    { t: "kv", title: "Position", items: [{ k: "Declared by parishes", v: ngn(r.declaredTotal) }, { k: "Confirmed received", v: ngn(r.confirmedReceived) }, { k: "Audited adjustments", v: ngn(r.adjustments) }, { k: "Pending verification", v: ngn(r.pending) }, { k: "Needs parish action", v: ngn(r.flagged) }, { k: "Rejected", v: ngn(r.rejected) }] },
    { t: "table", title: "Reconciliation checks", sheet: "Checks", cols: [{ h: "Check", w: 2 }, M("Figure A (NGN)"), M("Figure B (NGN)"), M("Difference (NGN)"), { h: "Result", kind: "center" }, { h: "Basis", w: 1.6 }], rows: checks.map(([t, a, c, note]) => [t, nz(a), nz(c), nz(a - c), a === c ? "Passed" : "Review", note]) },
    { t: "table", title: "By zone", sheet: "By zone", csv: false, cols: [{ h: "Zone", w: 1.3 }, M("Required (NGN)"), M("Confirmed (NGN)"), M("Outstanding (NGN)"), M("Pending verification (NGN)"), M("Needs action (NGN)"), M("Rejected (NGN)"), M("Levies confirmed (NGN)"), M("Contributions confirmed (NGN)")], rows: bz, totals: ["Total", ...[1, 2, 3, 4, 5, 6, 7, 8].map(tot)] },
    { t: "table", title: "Records with a variance", sheet: "Variances", csv: false, cols: [{ h: "Parish" }, { h: "Zone" }, { h: "Period" }, { h: "Detail", w: 1.4 }, M("Declared (NGN)"), M("Confirmed (NGN)"), { h: "Status" }, { h: "Reference" }], rows: recs.map((x) => [x.parish, x.zone, x.period, x.label, nz(x.amountKobo), nz(x.confirmedKobo), x.status, x.reference]), empty: "No variances: every confirmed amount matches what was declared." },
  ];
  return mk(b, { file: `financial-reconciliation-${i.year}-${i.month || "all"}`, title: "Financial Reconciliation Report", period: periodText(i.month, i.year), blocks, verification: `${failed ? `${failed} of ${checks.length} checks need review.` : `All ${checks.length} checks passed.`} ${VERIFY_STD}`, notes: [NOTE_NGN] });
}

export function confirmedDoc(b: Base, i: FinIn & { names: Names; reviewers: Map<string, string> }): ReportDoc {
  const n = i.names;
  const rows: { sort: string; cells: Cell[]; kobo: number; kind: string }[] = [];
  for (const r of i.rems) {
    if (i.parish && id(r.parish) !== i.parish) continue;
    const kind = r.kind === "yst" ? "Youth Sunday 40%" : r.category === "contribution" ? "Contribution" : "Levy";
    if (i.kind && ({ yst: "Youth Sunday 40%", levy: "Levy", contribution: "Contribution" } as any)[i.kind] !== kind) continue;
    const [z, a, p] = loc(r, n); const per = `${MONTHS[r.month - 1].slice(0, 3)} ${r.year}`;
    for (const { p: pay } of paymentsOf(r)) if (pay.status === "confirmed") rows.push({ sort: `${z}|${a}|${p}|${String(r.year * 100 + r.month)}`, kobo: pay.confirmedKobo ?? 0, kind, cells: [z, a, p, per, kind, r.description ?? "", nz(pay.amountKobo), nz(pay.confirmedKobo), lagosDay(pay.paidAt), pay.reference ?? "", lagos(pay.reviewedAt), i.reviewers.get(id(pay.reviewedBy)) ?? "", "Payment"] });
    for (const adj of r.adjustments ?? []) rows.push({ sort: `${z}|${a}|${p}|${String(r.year * 100 + r.month)}~`, kobo: adj.amountKobo, kind, cells: [z, a, p, per, kind, adj.reason ?? "Audited adjustment", "", nz(adj.amountKobo), lagosDay(adj.at), "", lagos(adj.at), adj.byName ?? "", "Audited adjustment"] });
  }
  rows.sort((x, y) => x.sort.localeCompare(y.sort));
  const by = (k: string) => sum(rows.filter((r) => r.kind === k).map((r) => r.kobo));
  const total = sum(rows.map((r) => r.kobo));
  const blocks: Block[] = [
    { t: "kv", title: "Summary", items: [{ k: "Confirmed total", v: ngn(total) }, { k: "Youth Sunday 40%", v: ngn(by("Youth Sunday 40%")) }, { k: "Levies", v: ngn(by("Levy")) }, { k: "Contributions", v: ngn(by("Contribution")) }, { k: "Lines", v: String(rows.length) }] },
    { t: "table", title: "Confirmed payments", sheet: "Confirmed payments", cols: [{ h: "Zone" }, { h: "Area" }, { h: "Parish", w: 1.3 }, { h: "Period", kind: "center" }, { h: "Type" }, { h: "Description", w: 1.3 }, M("Declared (NGN)"), M("Confirmed (NGN)"), { h: "Paid on" }, { h: "Bank reference" }, { h: "Verified on" }, { h: "Verified by" }, { h: "Line type" }], rows: rows.map((r) => r.cells), totals: ["Total", "", "", "", "", "", "", nz(total), "", "", "", "", ""], empty: "No confirmed payments match these filters." },
  ];
  return mk(b, { file: `confirmed-payments-${i.year}-${i.month || "all"}`, title: "Confirmed Payments Report", period: periodText(i.month, i.year), blocks, verification: "Every line listed here has been verified by finance. Audited manual adjustments are marked and included in the total.", notes: [NOTE_NGN] });
}

export function outstandingDoc(b: Base, i: FinIn & { names: Names }): ReportDoc {
  const n = i.names;
  const yst = i.rems.filter((r) => r.kind === "yst" && (!i.parish || id(r.parish) === i.parish));
  const list = yst.map((r) => ({ r, t: totals(r) })).filter(({ t }) => t.outstandingKobo > 0).map(({ r, t }) => {
    const pend = paymentsOf(r).filter(({ p }) => p.status === "submitted" || p.status === "awaiting_verification").reduce((s, { p }) => s + (p.amountKobo ?? 0), 0);
    const [z, a, p] = loc(r, n);
    return { z, a, p, per: `${MONTHS[r.month - 1].slice(0, 3)} ${r.year}`, ord: r.year * 100 + r.month, t, pend, status: FV_LABEL[obligationFv(r)] };
  }).sort((x, y) => y.t.outstandingKobo - x.t.outstandingKobo || x.p.localeCompare(y.p));
  const have = new Set(yst.map((r) => id(r.month) + "|" + id(r.parish)));
  const none = i.month ? parishesInScope(i.parishes, { year: i.year, month: i.month, zone: i.zone, area: i.area }).filter((p) => (!i.parish || id(p._id) === i.parish) && !have.has(`${i.month}|${id(p._id)}`)) : [];
  const T = (f: (x: any) => number) => nz(sum(list.map(f)));
  const blocks: Block[] = [
    { t: "kv", title: "Summary", items: [{ k: "Parishes with a balance", v: String(list.length) }, { k: "Total outstanding", v: ngn(sum(list.map((x) => x.t.outstandingKobo))) }, { k: "Declared, awaiting verification", v: ngn(sum(list.map((x) => x.pend))) }, ...(i.month ? [{ k: "No remittance recorded", v: String(none.length) }] : [])] },
    { t: "table", title: "Outstanding balances", sheet: "Outstanding", cols: [{ h: "Zone" }, { h: "Area" }, { h: "Parish", w: 1.3 }, { h: "Period", kind: "center" }, M("Required (NGN)"), M("Confirmed (NGN)"), M("Outstanding (NGN)"), M("Declared, awaiting verification (NGN)"), { h: "Status", w: 1.3 }], rows: list.map((x) => [x.z, x.a, x.p, x.per, nz(x.t.requiredKobo), nz(x.t.confirmedKobo), nz(x.t.outstandingKobo), nz(x.pend), x.status]), totals: ["Total", "", "", "", T((x) => x.t.requiredKobo), T((x) => x.t.confirmedKobo), T((x) => x.t.outstandingKobo), T((x) => x.pend), ""], empty: "No outstanding balances for these filters." },
    ...(i.month ? [{ t: "table" as const, title: "Parishes with no remittance recorded", sheet: "No remittance", csv: false, cols: [{ h: "Zone" }, { h: "Area" }, { h: "Parish", w: 1.4 }], rows: none.map((p) => [n.zone.get(id(p.zone)) ?? "", p.area ? n.area.get(id(p.area)) ?? "" : "", p.name] as Cell[]).sort((x, y) => String(x[0]).localeCompare(String(y[0])) || String(x[2]).localeCompare(String(y[2]))), empty: "Every parish has a remittance recorded." }] : []),
  ];
  return mk(b, { file: `outstanding-payments-${i.year}-${i.month || "all"}`, title: "Outstanding Payments Report", period: periodText(i.month, i.year), blocks, verification: "Outstanding means the required amount minus CONFIRMED money. Amounts awaiting verification are shown separately and do not reduce the balance until finance confirms them.", notes: [NOTE_NGN] });
}

// ------------------------------------------------------------------ attendance
export type AttIn = { from: Date; to: Date; sessions: any[]; counts: Map<string, { total: number; visitors: number }>; byZone: Map<string, number>; byArea: Map<string, number>; byParish: Map<string, number>; names: Names; provincial: boolean };
const dmy = (d: Date) => { const l = new Date(d.getTime() + 3600_000); return `${l.getUTCDate()} ${MONTHS[l.getUTCMonth()].slice(0, 3)} ${l.getUTCFullYear()}`; };
export function attendanceDoc(b: Base, i: AttIn): ReportDoc {
  const ses = i.sessions.map((s) => ({ s, c: i.counts.get(id(s._id)) ?? { total: 0, visitors: 0 } })).filter(({ c }) => c.total > 0 || i.provincial).sort((x, y) => +new Date(y.s.date) - +new Date(x.s.date));
  const total = sum(ses.map((x) => x.c.total)), vis = sum(ses.map((x) => x.c.visitors));
  const top = (m: Map<string, number>, names: Map<string, string>, n: number) => [...m].map(([k, v]) => [names.get(k) ?? "Unknown", v] as Cell[]).sort((x, y) => Number(y[1]) - Number(x[1]) || String(x[0]).localeCompare(String(y[0]))).slice(0, n);
  const place = (s: any) => (s.parish ? i.names.parish.get(id(s.parish)) : s.area ? i.names.area.get(id(s.area)) : s.zone ? i.names.zone.get(id(s.zone)) : "Province") ?? "";
  const blocks: Block[] = [
    { t: "kv", title: "Summary", items: [{ k: "Sessions", v: String(ses.length) }, { k: "Total check-ins", v: total.toLocaleString("en-NG") }, { k: "Members present", v: (total - vis).toLocaleString("en-NG") }, { k: "Visitors", v: vis.toLocaleString("en-NG") }, { k: "Average per session", v: ses.length ? String(Math.round(total / ses.length)) : "0" }] },
    { t: "table", title: "Sessions", sheet: "Sessions", cols: [{ h: "Date" }, { h: "Session", w: 1.6 }, { h: "Type" }, { h: "Level" }, { h: "Location", w: 1.2 }, I("Members present"), I("Visitors"), I("Total")], rows: ses.map(({ s, c }) => [lagosDay(s.date), s.title, s.kind, s.level, place(s), c.total - c.visitors, c.visitors, c.total]), totals: ["Total", "", "", "", "", total - vis, vis, total], empty: "No attendance recorded in this range." },
    { t: "table", title: "Attendance by zone", sheet: "By zone", csv: false, cols: [{ h: "Zone", w: 2 }, I("Check-ins")], rows: top(i.byZone, i.names.zone, 50) },
    { t: "table", title: "Attendance by area", sheet: "By area", csv: false, cols: [{ h: "Area", w: 2 }, I("Check-ins")], rows: top(i.byArea, i.names.area, 100) },
    { t: "table", title: "Attendance by parish", sheet: "By parish", csv: false, cols: [{ h: "Parish", w: 2 }, I("Check-ins")], rows: top(i.byParish, i.names.parish, 150) },
  ];
  return mk(b, { file: `attendance-${lagosDay(i.from)}-to-${lagosDay(i.to)}`, title: "Attendance Report", period: `${dmy(i.from)} to ${dmy(i.to)}`, blocks, notes: ["Attendance is attributed to the parish, area and zone recorded at the time of check-in, so later transfers do not rewrite history."] });
}

// ------------------------------------------------------------------ event registrations
export type RegIn = { event: any; regs: any[]; names: Names };
export function registrationsDoc(b: Base, i: RegIn): ReportDoc {
  const keys: { key: string; label: string }[] = (i.event?.customFields ?? []).map((c: any) => ({ key: c.key, label: c.label }));
  const rows = [...i.regs].sort(cmp((r) => i.names.zone.get(id(r.zone)) ?? "", (r) => r.name ?? ""));
  const cin = rows.filter((r) => r.checkedInAt).length;
  const blocks: Block[] = [
    { t: "kv", title: "Summary", items: [{ k: "Event", v: i.event?.title ?? "" }, { k: "Event date", v: lagos(i.event?.startsAt) }, ...(i.event?.venue ? [{ k: "Venue", v: i.event.venue }] : []), { k: "Registered", v: String(rows.length) }, { k: "Checked in", v: String(cin) }, ...(i.event?.capacity ? [{ k: "Capacity", v: String(i.event.capacity) }] : [])] },
    { t: "table", title: "Attendee list", sheet: "Attendees", cols: [{ h: "Reference" }, { h: "Name", w: 1.3 }, { h: "Phone" }, { h: "Email", w: 1.2 }, { h: "Zone" }, { h: "Area" }, { h: "Parish" }, ...keys.map((k) => ({ h: k.label })), { h: "Registered" }, { h: "Checked in", kind: "center" as const }], rows: rows.map((r) => [r.reference, r.name, r.phone, r.email ?? "", ...loc(r, i.names), ...keys.map((k) => { const v = r.answers?.[k.key]; return Array.isArray(v) ? v.join(", ") : v ?? ""; }), lagos(r.createdAt), r.checkedInAt ? "Yes" : "No"]), empty: "No registrations match these filters." },
  ];
  return mk(b, { file: `registrations-${i.event?.title ?? "event"}`, title: `Event Registrations: ${i.event?.title ?? ""}`, period: lagos(i.event?.startsAt).slice(0, 10) ? dmy(new Date(i.event.startsAt)) : "-", blocks, notes: ["Contains registrants' contact details. Handle as confidential."] });
}

// ------------------------------------------------------------------ members
export function membersDoc(b: Base, i: { rows: any[]; total: number }): ReportDoc {
  const minors = i.rows.filter((m) => m.restricted).length;
  const cols: Col[] = [{ h: "Member ID" }, { h: "Name", w: 1.4 }, { h: "Phone" }, { h: "Email", w: 1.2 }, { h: "Zone" }, { h: "Area" }, { h: "Parish" }, { h: "Category" }, { h: "Status" }, { h: "Date joined" }, { h: "Departments", w: 1.2 }, { h: "Leadership" }];
  const rows: Cell[][] = i.rows.map((m) => [m.memberId, m.name, m.restricted ? "(protected)" : m.phone, m.restricted ? "(protected)" : m.email ?? "", m.zone, m.area, m.parish, m.category, m.status, m.joinedAt ? lagosDay(m.joinedAt) : "", (m.departments ?? []).join(", "), m.leadership?.title ?? ""]);
  return mk(b, { file: "member-register", title: "Member Register", period: `As at ${dmy(b.now)}`, blocks: [{ t: "kv", title: "Summary", items: [{ k: "Members listed", v: String(rows.length) }, { k: "Under-18 records", v: String(minors) }] }, { t: "table", title: "Members", sheet: "Members", cols, rows, empty: "No members match these filters." }], notes: ["Contains personal information of church members. Handle as confidential.", ...(minors ? ["Contact details of members under 18 are protected and shown only to administrators permitted to see them."] : [])] });
}

// ------------------------------------------------------------------ leadership
export type LeadIn = { appointments: any[]; committees: any[]; depts: Map<string, string>; names: Names; status: string };
const orgText = (d: any, n: Names) => d.level === "province" ? "Province" : d.level === "zone" ? n.zone.get(id(d.zone)) ?? "" : d.level === "area" ? n.area.get(id(d.area)) ?? "" : n.parish.get(id(d.parish)) ?? "";
const LV: Record<string, number> = { province: 0, zone: 1, area: 2, parish: 3 };
export function leadershipDoc(b: Base, i: LeadIn): ReportDoc {
  const ap = [...i.appointments].sort((x, y) => (LV[x.level] ?? 9) - (LV[y.level] ?? 9) || orgText(x, i.names).localeCompare(orgText(y, i.names)) || String(x.position).localeCompare(String(y.position)));
  const cm = [...i.committees].sort((x, y) => (LV[x.level] ?? 9) - (LV[y.level] ?? 9) || orgText(x, i.names).localeCompare(orgText(y, i.names)) || String(x.name).localeCompare(String(y.name)));
  const blocks: Block[] = [
    { t: "kv", title: "Summary", items: [{ k: "Appointments", v: String(ap.length) }, { k: "Committees", v: String(cm.length) }] },
    { t: "table", title: "Appointments", sheet: "Appointments", cols: [{ h: "Level" }, { h: "Organisation", w: 1.2 }, { h: "Position", w: 1.3 }, { h: "Holder", w: 1.3 }, { h: "Department" }, { h: "Status" }, { h: "From" }, { h: "To" }, { h: "Responsibilities", w: 2 }], rows: ap.map((a) => [a.level, orgText(a, i.names), a.position, a.holderName, a.department ? i.depts.get(id(a.department)) ?? "" : "", a.status, lagosDay(a.startsAt), lagosDay(a.endsAt), (a.responsibilities ?? []).join("; ")]), empty: "No appointments match these filters." },
    { t: "table", title: "Committees", sheet: "Committees", csv: false, cols: [{ h: "Level" }, { h: "Organisation", w: 1.2 }, { h: "Committee", w: 1.4 }, { h: "Chair" }, I("Members"), { h: "Status" }, { h: "Formed" }, { h: "Purpose", w: 2 }], rows: cm.map((c) => [c.level, orgText(c, i.names), c.name, (c.members ?? []).find((m: any) => m.role === "chair")?.name ?? "", (c.members ?? []).length, c.status, lagosDay(c.formedAt), c.purpose ?? ""]), empty: "No committees match these filters." },
  ];
  return mk(b, { file: "leadership-report", title: "Leadership Report", period: i.status === "all" ? `All appointments, as at ${dmy(b.now)}` : `Current appointments as at ${dmy(b.now)}`, blocks, notes: ["Shows only the levels your role may view."] });
}
