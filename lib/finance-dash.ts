/**
 * Provincial financial dashboard maths. Pure: takes database rows, returns figures. Nothing here is hardcoded;
 * every number is derived from Remittance / Parish records. Only CONFIRMED money counts as received.
 */
import { PROBLEM_STATUSES, obligationFv, totals } from "./verification";

export type Filter = { year: number; month: number; zone?: string; area?: string; parish?: string };
export const PENDING = ["submitted", "awaiting_verification"] as const;
export const FLAGGED = ["payment_not_found", "amount_mismatch", "resubmission_required"] as const;

export const METRICS = [
  "expected", "confirmed", "outstanding", "pending", "flagged", "rejected", "levies", "contributions", "partial", "overpaid",
  "parishes_expected", "parishes_submitted", "parishes_missing", "ledger", "variance",
] as const;
export type Metric = (typeof METRICS)[number];

const id = (v: any) => (v ? String(v) : "");
const pays = (r: any): any[] => [r, ...(r.payments ?? [])];
const sum = (a: number[]) => a.reduce((n, x) => n + x, 0);

export function periodEnd(f: Filter) { return f.month ? new Date(f.year, f.month, 0, 23, 59, 59, 999) : new Date(f.year, 11, 31, 23, 59, 59, 999); }

type Names = { zone: Map<string, string>; area: Map<string, string>; parish: Map<string, string> };

/** Does a row fall inside the filter? (rows are expected to be pre-filtered by year in the query, this is the final word.) */
export function inFilter(r: any, f: Filter) {
  if (r.year !== f.year) return false;
  if (f.month && r.month !== f.month) return false;
  if (f.zone && id(r.zone) !== f.zone) return false;
  if (f.area && id(r.area) !== f.area) return false;
  if (f.parish && id(r.parish) !== f.parish) return false;
  return true;
}

export function parishesInScope(parishes: any[], f: Filter) {
  const end = periodEnd(f);
  return parishes.filter((p) => p.active !== false && (!p.createdAt || new Date(p.createdAt) <= end)
    && (!f.zone || id(p.zone) === f.zone) && (!f.area || id(p.area) === f.area) && (!f.parish || id(p._id) === f.parish));
}

type Agg = {
  expected: number; confirmed: number; outstanding: number; overpaid: number; declared: number;
  pending: number; flagged: number; rejected: number; levies: number; leviesConfirmed: number; contributions: number; contributionsConfirmed: number;
  partialCount: number; partialConfirmed: number; overCount: number; submitted: number; parishes: number;
};
const blank = (): Agg => ({ expected: 0, confirmed: 0, outstanding: 0, overpaid: 0, declared: 0, pending: 0, flagged: 0, rejected: 0, levies: 0, leviesConfirmed: 0, contributions: 0, contributionsConfirmed: 0, partialCount: 0, partialConfirmed: 0, overCount: 0, submitted: 0, parishes: 0 });

/** Fold one remittance into an aggregate. */
export function addRow(a: Agg, r: any) {
  if (r.kind === "yst") {
    const t = totals(r);
    a.expected += t.requiredKobo; a.confirmed += t.confirmedKobo; a.outstanding += t.outstandingKobo; a.overpaid += t.overpaidKobo;
    if (t.confirmedKobo > 0 && t.outstandingKobo > 0) { a.partialCount++; a.partialConfirmed += t.confirmedKobo; }
    if (t.overpaidKobo > 0) a.overCount++;
  } else {
    const key = r.category === "contribution" ? "contributions" : "levies";
    for (const p of pays(r)) { a[key] += p.amountKobo ?? 0; if (p.status === "confirmed") a[`${key}Confirmed` as "leviesConfirmed"] += p.confirmedKobo ?? 0; }
  }
  for (const p of pays(r)) {
    const n = p.amountKobo ?? 0; a.declared += n;
    if ((PENDING as readonly string[]).includes(p.status)) a.pending += n;
    else if ((FLAGGED as readonly string[]).includes(p.status)) a.flagged += n;
    else if (p.status === "rejected") a.rejected += n;
  }
}

export type DashInput = { rows: any[]; parishes: any[]; zones: any[]; areas: any[]; filter: Filter };

export function dashboard({ rows, parishes, zones, areas, filter }: DashInput) {
  const scoped = rows.filter((r) => inFilter(r, filter));
  const pr = parishesInScope(parishes, filter);
  const total = blank();
  scoped.forEach((r) => addRow(total, r));
  const submittedParishes = new Set(scoped.filter((r) => r.kind === "yst").map((r) => id(r.parish)));
  total.parishes = pr.length; total.submitted = pr.filter((p) => submittedParishes.has(id(p._id))).length;

  const nm = (l: any[]) => new Map<string, string>(l.map((x) => [id(x._id), x.name]));
  const names: Names = { zone: nm(zones), area: nm(areas), parish: nm(parishes) };

  // ---- trends: 12 months of the selected year, same location filters ----
  const trend = Array.from({ length: 12 }, (_, i) => {
    const f = { ...filter, month: i + 1 };
    const a = blank();
    rows.filter((r) => inFilter(r, f)).forEach((r) => addRow(a, r));
    const ps = parishesInScope(parishes, f);
    const sub = new Set(rows.filter((r) => inFilter(r, f) && r.kind === "yst").map((r) => id(r.parish)));
    return { month: i + 1, expected: a.expected, confirmed: a.confirmed, outstanding: a.outstanding, pending: a.pending, levies: a.levies + a.contributions, parishes: ps.length, submitted: ps.filter((p) => sub.has(id(p._id))).length };
  });

  // ---- breakdowns ----
  const group = (keyOf: (p: any) => string, labelOf: (k: string) => string, rowKey: (r: any) => string) => {
    const m = new Map<string, Agg>();
    for (const p of pr) { const k = keyOf(p); if (!k) continue; if (!m.has(k)) m.set(k, blank()); m.get(k)!.parishes++; if (submittedParishes.has(id(p._id))) m.get(k)!.submitted++; }
    for (const r of scoped) { const k = rowKey(r); if (!k) continue; if (!m.has(k)) m.set(k, blank()); addRow(m.get(k)!, r); }
    return [...m.entries()].map(([k, a]) => ({ id: k, name: labelOf(k), ...a })).sort((x, y) => y.confirmed - x.confirmed || x.name.localeCompare(y.name));
  };
  const byZone = group((p) => id(p.zone), (k) => names.zone.get(k) ?? "Unknown zone", (r) => id(r.zone));
  const byArea = group((p) => id(p.area), (k) => names.area.get(k) ?? "Unknown area", (r) => id(r.area));
  const byParish = group((p) => id(p._id), (k) => names.parish.get(k) ?? "Unknown parish", (r) => id(r.parish)).map((x) => {
    const p = parishes.find((q) => id(q._id) === x.id);
    return { ...x, zone: p ? names.zone.get(id(p.zone)) ?? "" : "", area: p?.area ? names.area.get(id(p.area)) ?? "" : "", hasSubmitted: submittedParishes.has(x.id) };
  });

  // ---- reconciliation: every declared kobo is accounted for exactly once ----
  const all = scoped.flatMap((r) => pays(r).map((p) => ({ r, p })));
  const sumBy = (pred: (s: string) => boolean) => sum(all.filter(({ p }) => pred(p.status)).map(({ p }) => p.amountKobo ?? 0));
  const part = {
    confirmed: sumBy((s) => s === "confirmed"),
    pending: sumBy((s) => (PENDING as readonly string[]).includes(s)),
    flagged: sumBy((s) => (FLAGGED as readonly string[]).includes(s)),
    rejected: sumBy((s) => s === "rejected"),
  };
  const declaredTotal = sum(all.map(({ p }) => p.amountKobo ?? 0));
  const confirmedPays = all.filter(({ p }) => p.status === "confirmed");
  const confirmedReceived = sum(confirmedPays.map(({ p }) => p.confirmedKobo ?? 0));
  const adjustments = sum(scoped.flatMap((r) => (r.adjustments ?? []).map((a: any) => a.amountKobo)));
  const yst = scoped.filter((r) => r.kind === "yst");
  const req = sum(yst.map((r) => totals(r).requiredKobo)), conf = sum(yst.map((r) => totals(r).confirmedKobo));
  const out = sum(yst.map((r) => totals(r).outstandingKobo)), over = sum(yst.map((r) => totals(r).overpaidKobo));
  const reconciliation = {
    declaredTotal, ...part,
    partitionSum: part.confirmed + part.pending + part.flagged + part.rejected,
    partitionOk: part.confirmed + part.pending + part.flagged + part.rejected === declaredTotal,
    confirmedDeclared: part.confirmed, confirmedReceived, confirmedDifference: confirmedReceived - part.confirmed, adjustments,
    receivedPlusAdjustments: confirmedReceived + adjustments,
    yst: { required: req, confirmed: conf, outstanding: out, overpaid: over, ok: req - conf === out - over },
    // The headline "confirmed" on the dashboard must equal confirmed yst money; levy money is shown apart.
    confirmedYstEqualsCard: conf === total.confirmed,
  };

  return { filter, cards: total, trend, byZone, byArea, byParish, reconciliation, counts: { remittances: scoped.length, payments: all.length } };
}

export type RecordRow = { id: string; parishId: string; parish: string; zone: string; area: string; kind: string; label: string; period: string; amountKobo: number; confirmedKobo: number; status: string; reference: string; at: string; note: string };

/** The underlying records behind a summary figure. */
export function recordsFor(metric: Metric, { rows, parishes, zones, areas, filter }: DashInput, monthName: (m: number) => string): RecordRow[] {
  const scoped = rows.filter((r) => inFilter(r, filter));
  const nm = (l: any[]) => new Map<string, string>(l.map((x) => [id(x._id), x.name]));
  const [Z, A, P] = [nm(zones), nm(areas), nm(parishes)];
  const base = (r: any) => ({ id: id(r._id), parishId: id(r.parish), parish: P.get(id(r.parish)) ?? "", zone: Z.get(id(r.zone)) ?? "", area: r.area ? A.get(id(r.area)) ?? "" : "", kind: r.kind === "yst" ? "Youth Sunday 40%" : r.category === "contribution" ? "Contribution" : "Levy", period: `${monthName(r.month)} ${r.year}` });
  const payRow = (r: any, p: any, i: number): RecordRow => ({ ...base(r), label: r.kind === "yst" ? (i === 0 ? "Payment 1 (original)" : `Payment ${i + 1}`) : r.description ?? "Levy", amountKobo: p.amountKobo ?? 0, confirmedKobo: p.status === "confirmed" ? p.confirmedKobo ?? 0 : 0, status: p.status, reference: p.reference ?? "", at: p.paidAt ? new Date(p.paidAt).toISOString() : "", note: p.status === "amount_mismatch" && p.seenKobo != null ? `Finance saw ${p.seenKobo} kobo` : "" });
  const oblRow = (r: any, amount: number, note: string): RecordRow => { const t = totals(r); return { ...base(r), label: "Obligation", amountKobo: amount, confirmedKobo: t.confirmedKobo, status: obligationFv(r), reference: r.reference ?? "", at: r.paidAt ? new Date(r.paidAt).toISOString() : "", note }; };
  const allPays = scoped.flatMap((r) => pays(r).map((p, i) => ({ r, p, i })));

  switch (metric) {
    case "expected": return scoped.filter((r) => r.kind === "yst").map((r) => oblRow(r, totals(r).requiredKobo, `Offering ${r.offeringKobo ?? 0} kobo at ${(r.percentBp ?? 0) / 100}%`));
    case "confirmed": return allPays.filter(({ r, p }) => r.kind === "yst" && p.status === "confirmed").map(({ r, p, i }) => payRow(r, p, i));
    case "outstanding": return scoped.filter((r) => r.kind === "yst" && totals(r).outstandingKobo > 0).map((r) => oblRow(r, totals(r).outstandingKobo, "Required minus confirmed"));
    case "pending": return allPays.filter(({ p }) => (PENDING as readonly string[]).includes(p.status)).map(({ r, p, i }) => payRow(r, p, i));
    case "flagged": return allPays.filter(({ p }) => (FLAGGED as readonly string[]).includes(p.status)).map(({ r, p, i }) => payRow(r, p, i));
    case "rejected": return allPays.filter(({ p }) => p.status === "rejected").map(({ r, p, i }) => payRow(r, p, i));
    case "levies": return allPays.filter(({ r }) => r.kind === "levy" && r.category !== "contribution").map(({ r, p, i }) => payRow(r, p, i));
    case "contributions": return allPays.filter(({ r }) => r.kind === "levy" && r.category === "contribution").map(({ r, p, i }) => payRow(r, p, i));
    case "partial": return scoped.filter((r) => r.kind === "yst" && totals(r).confirmedKobo > 0 && totals(r).outstandingKobo > 0).map((r) => oblRow(r, totals(r).outstandingKobo, "Part-paid: balance still due"));
    case "overpaid": return scoped.filter((r) => r.kind === "yst" && totals(r).overpaidKobo > 0).map((r) => oblRow(r, totals(r).overpaidKobo, "Confirmed above the amount required"));
    case "ledger": return allPays.map(({ r, p, i }) => payRow(r, p, i)).sort((a, b) => a.at.localeCompare(b.at));
    case "variance": return scoped.filter((r) => r.kind === "yst").flatMap((r) => {
      const t = totals(r); const out: RecordRow[] = [];
      if (t.declaredKobo !== t.requiredKobo) out.push(oblRow(r, t.declaredKobo - t.requiredKobo, `Declared differs from required by ${t.declaredKobo - t.requiredKobo} kobo`));
      else if (t.confirmedKobo !== t.requiredKobo) out.push(oblRow(r, t.confirmedKobo - t.requiredKobo, "Confirmed differs from required"));
      return out;
    });
    default: {
      const end = parishesInScope(parishes, filter);
      const sub = new Set(scoped.filter((r) => r.kind === "yst").map((r) => id(r.parish)));
      const pick = metric === "parishes_submitted" ? end.filter((p) => sub.has(id(p._id))) : metric === "parishes_missing" ? end.filter((p) => !sub.has(id(p._id))) : end;
      return pick.map((p) => ({ id: id(p._id), parishId: id(p._id), parish: p.name, zone: Z.get(id(p.zone)) ?? "", area: p.area ? A.get(id(p.area)) ?? "" : "", kind: "Parish", label: sub.has(id(p._id)) ? "Submitted" : "Not submitted", period: filter.month ? `${monthName(filter.month)} ${filter.year}` : String(filter.year), amountKobo: 0, confirmedKobo: 0, status: sub.has(id(p._id)) ? "submitted" : "not_submitted", reference: "", at: "", note: "" }));
    }
  }
}
export { PROBLEM_STATUSES };
