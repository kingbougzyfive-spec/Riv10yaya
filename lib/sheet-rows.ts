/**
 * Pure row builders for the Google Sheets copy. Database rows in, plain tables out; no network, no database.
 * Rules that matter:
 *  - Column A of every table is a stable "Record ID" taken from the database, so a row is always the same row.
 *  - Only CONFIRMED money is shown as confirmed. Pending, flagged and rejected money sits in its own tab/columns.
 *  - Contact details of members and registrants are never included.
 */
import { addRow, blank, parishesInScope, type Agg } from "./finance-dash";
import { FIELDS } from "./report-config";
import { FV_LABEL, PROBLEM_STATUSES, obligationFv, paymentFv, totals } from "./verification";

export type Cell = string | number | boolean | null;
export type Table = { head: string[]; rows: Cell[][]; warnings: string[] };
export type Names = { zone: Map<string, string>; area: Map<string, string>; parish: Map<string, string> };

export const MAX_ROWS = 50_000;
const id = (v: any) => (v ? String(v) : "");
const naira = (k?: number | null) => (k === null || k === undefined ? "" : Number((k / 100).toFixed(2)));
const nz = (k?: number | null) => Number(((k ?? 0) / 100).toFixed(2));
/** Africa/Lagos is a fixed UTC+1, so no daylight-saving rules are needed. */
export const stamp = (d?: Date | string | null) => (d ? new Date(new Date(d).getTime() + 3600_000).toISOString().slice(0, 16).replace("T", " ") : "");
export const dayOf = (d?: Date | string | null) => stamp(d).slice(0, 10);
const period = (r: { year: number; month: number }) => `${r.year}-${String(r.month).padStart(2, "0")}`;
const loc = (r: any, n: Names) => [n.zone.get(id(r.zone)) ?? "", r.area ? n.area.get(id(r.area)) ?? "" : "", r.parish ? n.parish.get(id(r.parish)) ?? "" : ""];
const kindLabel = (r: any) => (r.kind === "yst" ? "Youth Sunday 40%" : r.category === "contribution" ? "Contribution" : "Levy");
const num = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** The original payment and any additional ones as uniformly shaped payments with a stable id. */
export function paymentsOf(r: any) {
  const main = { id: `${r._id}/main`, p: r, main: true };
  return [main, ...(r.payments ?? []).map((p: any) => ({ id: `${r._id}/${p._id}`, p, main: false }))];
}

/** Sort by one key descending, then by Record ID so ordering never changes between runs. */
const stable = (rows: Cell[][], col: number, desc = true) => rows.sort((a, b) => { const x = String(a[col]), y = String(b[col]); return x === y ? String(a[0]).localeCompare(String(b[0])) : desc ? y.localeCompare(x) : x.localeCompare(y); });

/** One row per Record ID. If a duplicate ever appears, the first is kept and it is reported. */
export function dedupeById(rows: Cell[][]): { rows: Cell[][]; dropped: number } {
  const seen = new Set<string>(); const out: Cell[][] = []; let dropped = 0;
  for (const r of rows) { const k = String(r[0]); if (!k || seen.has(k)) { dropped++; continue; } seen.add(k); out.push(r); }
  return { rows: out, dropped };
}

export function finish(head: string[], rows: Cell[][]): Table {
  const d = dedupeById(rows); const warnings: string[] = [];
  if (d.dropped) warnings.push(`${d.dropped} duplicate record id${d.dropped === 1 ? "" : "s"} skipped`);
  let out = d.rows;
  if (out.length > MAX_ROWS) { warnings.push(`Only the first ${MAX_ROWS.toLocaleString()} of ${out.length.toLocaleString()} rows were sent`); out = out.slice(0, MAX_ROWS); }
  return { head, rows: out, warnings };
}

export function parishRegister(parishes: any[], users: any[], n: Names): Table {
  const admin = new Map<string, any>();
  for (const u of [...users].filter((u) => u.role === "parish_admin" && u.active !== false && u.parish).sort((a, b) => String(a.name).localeCompare(String(b.name)))) if (!admin.has(id(u.parish))) admin.set(id(u.parish), u);
  const rows = parishes.map((p) => [id(p._id), p.name, n.zone.get(id(p.zone)) ?? "", p.area ? n.area.get(id(p.area)) ?? "" : "(directly under zone)", p.address ?? "", p.active === false ? "Inactive" : "Active", stamp(p.createdAt), admin.get(id(p._id))?.name ?? "", admin.get(id(p._id))?.phone ?? ""] as Cell[]);
  rows.sort((a, b) => String(a[2]).localeCompare(String(b[2])) || String(a[3]).localeCompare(String(b[3])) || String(a[1]).localeCompare(String(b[1])) || String(a[0]).localeCompare(String(b[0])));
  return finish(["Record ID", "Parish", "Zone", "Area", "Address", "Status", "Registered on", "Administrator", "Administrator phone"], rows);
}

export function parishSubmissions(reports: any[], rems: any[], n: Names): Table {
  const rm = new Map<string, any>(rems.map((r) => [id(r._id), r]));
  const rows = reports.filter((r) => r.type === "parish" && r.status !== "draft").map((r) => {
    const m = r.remittance ? rm.get(id(r.remittance)) : null; const t = m ? totals(m) : null; const a = r.activity ?? {};
    return [id(r._id), r.reportId ?? "", ...loc(r, n), period(r), r.status, r.revision ?? 1, stamp(r.submittedAt), r.contact?.fullName ?? "", r.contact?.phone ?? "", num(a.youthSundayAttendance), num(a.youthMeetingAttendance), num(a.meetingsHeld), num(a.newMembers), m ? FV_LABEL[obligationFv(m)] : "No remittance recorded", m ? naira(m.offeringKobo) : "", t ? naira(t.requiredKobo) : "", t ? naira(t.confirmedKobo) : ""] as Cell[];
  });
  return finish(["Record ID", "Report ID", "Zone", "Area", "Parish", "Period", "Report status", "Revision", "Submitted on", "Administrator", "Phone", "Youth Sunday attendance", "Youth meeting attendance", "Meetings held", "New members", "Payment status", "Offering (NGN)", "Required (NGN)", "Confirmed (NGN)"], stable(rows, 5));
}

export function confirmedPayments(rems: any[], n: Names): Table {
  const rows: Cell[][] = [];
  for (const r of rems) {
    for (const { id: pid, p } of paymentsOf(r)) {
      if (p.status !== "confirmed") continue;
      rows.push([pid, id(r._id), "Payment", kindLabel(r), ...loc(r, n), period(r), r.description ?? "", nz(p.amountKobo), nz(p.confirmedKobo), dayOf(p.paidAt), p.reference ?? "", stamp(p.reviewedAt)]);
    }
    // Audited manual adjustments count towards confirmed money, so they are listed or the tab would not add up.
    for (const a of r.adjustments ?? []) rows.push([`${r._id}/adj-${a._id}`, id(r._id), "Audited adjustment", kindLabel(r), ...loc(r, n), period(r), a.reason ?? "", "", nz(a.amountKobo), dayOf(a.at), "", stamp(a.at)]);
  }
  return finish(["Record ID", "Remittance ID", "Type", "Kind", "Zone", "Area", "Parish", "Period", "Description", "Declared by parish (NGN)", "Confirmed (NGN)", "Paid on", "Bank reference", "Verified on"], stable(rows, 7));
}

export function outstandingPayments(rems: any[], n: Names): Table {
  const rows: Cell[][] = [];
  for (const r of rems) {
    if (r.kind !== "yst") continue;
    const t = totals(r); if (t.outstandingKobo <= 0) continue;
    const awaiting = paymentsOf(r).filter(({ p }) => p.status === "submitted" || p.status === "awaiting_verification").reduce((s, { p }) => s + (p.amountKobo ?? 0), 0);
    rows.push([id(r._id), ...loc(r, n), period(r), nz(t.requiredKobo), nz(t.confirmedKobo), nz(t.outstandingKobo), nz(t.declaredKobo), nz(awaiting), FV_LABEL[obligationFv(r)]]);
  }
  return finish(["Record ID", "Zone", "Area", "Parish", "Period", "Required (NGN)", "Confirmed (NGN)", "Outstanding (NGN)", "Declared by parish (NGN)", "Awaiting verification (NGN)", "Status"], stable(rows, 4));
}

export const pendingGroup = (status: string) => (status === "confirmed" ? "" : status === "rejected" ? "Rejected" : PROBLEM_STATUSES.includes(status) ? "Needs parish action" : "Pending verification");

export function pendingVerification(rems: any[], n: Names): Table {
  const rows: Cell[][] = [];
  for (const r of rems) for (const { id: pid, p } of paymentsOf(r)) {
    if (p.status === "confirmed") continue;
    rows.push([pid, id(r._id), kindLabel(r), ...loc(r, n), period(r), r.description ?? "", pendingGroup(p.status), FV_LABEL[paymentFv(p)], nz(p.amountKobo), naira(p.seenKobo), dayOf(p.paidAt), p.reference ?? "", stamp(p.createdAt ?? r.createdAt), stamp(p.reviewedAt)]);
  }
  return finish(["Record ID", "Remittance ID", "Kind", "Zone", "Area", "Parish", "Period", "Description", "Group", "Status", "Declared by parish (NGN)", "Amount finance saw (NGN)", "Paid on", "Bank reference", "Uploaded", "Reviewed on"], stable(rows, 7));
}

/** Levies and contributions share a shape but are separate tabs: the category decides. */
export function levyRows(rems: any[], n: Names, category: "levy" | "contribution"): Table {
  const rows: Cell[][] = [];
  for (const r of rems) {
    if (r.kind !== "levy" || (r.category ?? "levy") !== category) continue;
    const ps = paymentsOf(r).map((x) => x.p); const sum = (f: (p: any) => boolean, v: (p: any) => number) => ps.filter(f).reduce((s, p) => s + v(p), 0);
    const declared = sum(() => true, (p) => p.amountKobo ?? 0);
    const confirmed = sum((p) => p.status === "confirmed", (p) => p.confirmedKobo ?? 0) + (r.adjustments ?? []).reduce((s: number, a: any) => s + a.amountKobo, 0);
    const pending = sum((p) => pendingGroup(p.status) === "Pending verification", (p) => p.amountKobo ?? 0);
    const action = sum((p) => pendingGroup(p.status) === "Needs parish action", (p) => p.amountKobo ?? 0);
    const rejected = sum((p) => p.status === "rejected", (p) => p.amountKobo ?? 0);
    rows.push([id(r._id), ...loc(r, n), period(r), r.description ?? "", nz(declared), nz(confirmed), nz(pending), nz(action), nz(rejected), FV_LABEL[obligationFv({ ...r, requiredKobo: declared })], ps.length]);
  }
  return finish(["Record ID", "Zone", "Area", "Parish", "Period", "Description", "Declared by parish (NGN)", "Confirmed (NGN)", "Pending verification (NGN)", "Needs parish action (NGN)", "Rejected (NGN)", "Status", "Payments"], stable(rows, 4));
}

export type SessionCounts = Map<string, { total: number; visitors: number; qr: number }>;

export function parishAttendance(sessions: any[], counts: SessionCounts, n: Names): Table {
  const rows = sessions.filter((s) => s.level === "parish").map((s) => {
    const c = counts.get(id(s._id)) ?? { total: 0, visitors: 0, qr: 0 };
    return [id(s._id), s.title, s.kind, ...loc(s, n), dayOf(s.date), c.total - c.visitors, c.visitors, c.total, c.qr, c.total - c.qr, s.event ? "Yes" : ""] as Cell[];
  });
  return finish(["Record ID", "Session", "Type", "Zone", "Area", "Parish", "Date", "Members present", "Visitors", "Total", "QR check-ins", "Manual entries", "Linked to an event"], stable(rows, 6));
}

export type SummaryInput = { rems: any[]; reports: any[]; parishes: any[]; areas: any[]; zones: any[] };
const MONEY_HEAD = ["Required (NGN)", "Confirmed (NGN)", "Outstanding (NGN)", "Pending verification (NGN)", "Needs parish action (NGN)", "Rejected (NGN)", "Levies confirmed (NGN)", "Contributions confirmed (NGN)"];
const money = (a: Agg): Cell[] => [nz(a.expected), nz(a.confirmed), nz(a.outstanding), nz(a.pending), nz(a.flagged), nz(a.rejected), nz(a.leviesConfirmed), nz(a.contributionsConfirmed)];

/** Per group and month. Money is folded with the same rules as the finance dashboard, so the two always agree. */
export function summaries(level: "area" | "zone" | "province", { rems, reports, parishes, areas, zones }: SummaryInput): Table {
  const pr = reports.filter((r) => r.type === "parish" && r.status !== "draft");
  const periods = new Map<string, { year: number; month: number }>();
  for (const r of [...rems, ...pr]) periods.set(period(r), { year: r.year, month: r.month });
  const groups: { key: string; zone?: string; area?: string; names: string[]; areaCount?: number; zoneCount?: number }[] =
    level === "area" ? areas.filter((a) => a.active !== false).map((a) => ({ key: id(a._id), area: id(a._id), zone: id(a.zone), names: [zones.find((z) => id(z._id) === id(a.zone))?.name ?? "", a.name] }))
    : level === "zone" ? zones.filter((z) => z.active !== false).map((z) => ({ key: id(z._id), zone: id(z._id), names: [z.name] }))
    : [{ key: "province", names: [] }];
  const rows: Cell[][] = [];
  for (const [per, { year, month }] of periods) for (const g of groups) {
    const inG = (x: any) => (level === "area" ? id(x.area) === g.area : level === "zone" ? id(x.zone) === g.zone : true);
    const ps = parishesInScope(parishes, { year, month, ...(level === "area" ? { area: g.area } : level === "zone" ? { zone: g.zone } : {}) });
    const agg = blank();
    for (const r of rems) if (r.year === year && r.month === month && inG(r)) addRow(agg, r);
    const rep = pr.filter((r) => r.year === year && r.month === month && inG(r));
    const inScope = new Set(ps.map((p) => id(p._id)));
    const submitted = new Set(rep.map((r) => id(r.parish)).filter((p) => inScope.has(p)));
    if (!ps.length && !rep.length && !agg.declared && !agg.expected) continue;
    const sumAct = (k: string) => rep.reduce((s, r) => s + num(r.activity?.[k]), 0);
    const common: Cell[] = [ps.length, submitted.size, Math.max(0, ps.length - submitted.size), sumAct("youthSundayAttendance"), sumAct("youthMeetingAttendance"), sumAct("newMembers"), ...money(agg)];
    const upper = reports.filter((r) => r.status !== "draft" && r.year === year && r.month === month && r.type === (level === "area" ? "area" : "zone") && (level === "area" ? id(r.area) === g.area : id(r.zone) === g.zone));
    if (level === "area") rows.push([`area:${g.key}:${per}`, g.names[0], g.names[1], per, ...common, upper.length ? "Submitted" : "Not submitted"]);
    else if (level === "zone") {
      const zAreas = areas.filter((a) => a.active !== false && id(a.zone) === g.zone);
      const aRep = new Set(reports.filter((r) => r.type === "area" && r.status !== "draft" && r.year === year && r.month === month && id(r.zone) === g.zone).map((r) => id(r.area)));
      rows.push([`zone:${g.key}:${per}`, g.names[0], per, zAreas.length, aRep.size, ...common, upper.length ? "Submitted" : "Not submitted"]);
    } else {
      const zRep = new Set(reports.filter((r) => r.type === "zone" && r.status !== "draft" && r.year === year && r.month === month).map((r) => id(r.zone)));
      rows.push([`province:${per}`, per, zones.filter((z) => z.active !== false).length, areas.filter((a) => a.active !== false).length, zRep.size, ...common]);
    }
  }
  const mid = ["Parishes", "Parish reports submitted", "Parish reports missing", "Youth Sunday attendance (reported)", "Youth meeting attendance (reported)", "New members (reported)", ...MONEY_HEAD];
  if (level === "area") return finish(["Record ID", "Zone", "Area", "Period", ...mid, "Area report"], stable(rows, 3));
  if (level === "zone") return finish(["Record ID", "Zone", "Period", "Areas", "Area reports submitted", ...mid, "Zonal report"], stable(rows, 2));
  return finish(["Record ID", "Period", "Zones", "Areas", "Zonal reports submitted", ...mid], stable(rows, 1));
}

export function eventRegistrations(regs: any[], events: any[], n: Names, minorMembers: Set<string>): Table {
  const ev = new Map<string, any>(events.map((e) => [id(e._id), e]));
  const rows = regs.map((r) => [r.regId, r.reference, ev.get(id(r.event))?.title ?? "", r.member && minorMembers.has(id(r.member)) ? "Under 18 (name withheld)" : r.name, ...loc(r, n), r.status, stamp(r.createdAt), stamp(r.checkedInAt), r.member ? "Yes" : "No"] as Cell[]);
  return finish(["Record ID", "Reference", "Event", "Name", "Zone", "Area", "Parish", "Status", "Registered on", "Checked in on", "Signed-in member"], stable(rows, 8));
}

export function eventAttendance(events: any[], regCounts: Map<string, { registered: number; cancelled: number; checkedIn: number }>, sessions: any[], counts: SessionCounts): Table {
  const rows = events.map((e) => {
    const c = regCounts.get(id(e._id)) ?? { registered: 0, cancelled: 0, checkedIn: 0 };
    const ss = sessions.filter((s) => id(s.event) === id(e._id));
    const scanned = ss.reduce((s, x) => s + (counts.get(id(x._id))?.total ?? 0), 0);
    return [id(e._id), e.title, e.status, stamp(e.startsAt), e.venue ?? "", e.capacity || "Unlimited", c.registered, c.cancelled, c.checkedIn, c.registered ? Number(((c.checkedIn / c.registered) * 100).toFixed(1)) : "", ss.length, scanned] as Cell[];
  });
  return finish(["Record ID", "Event", "Status", "Starts", "Venue", "Capacity", "Registered", "Cancelled", "Checked in", "Check-in rate (%)", "Attendance sessions", "People scanned in sessions"], stable(rows, 3));
}

export function activityReports(reports: any[], n: Names): Table {
  const cols: { key: string; label: string }[] = [];
  for (const f of [...FIELDS.parish, ...FIELDS.area, ...FIELDS.zone]) if (!cols.some((c) => c.key === f.key)) cols.push({ key: f.key, label: f.label });
  const rows = reports.filter((r) => r.status !== "draft").map((r) => [id(r._id), r.reportId ?? "", r.type, ...loc(r, n), period(r), r.status, r.revision ?? 1, stamp(r.submittedAt), r.contact?.fullName ?? "", ...cols.map((c) => { const v = r.activity?.[c.key]; return v === undefined || v === null ? "" : typeof v === "number" ? v : String(v).slice(0, 5000); })] as Cell[]);
  return finish(["Record ID", "Report ID", "Level", "Zone", "Area", "Parish", "Period", "Status", "Revision", "Submitted on", "Administrator", ...cols.map((c) => c.label)], stable(rows, 6));
}
