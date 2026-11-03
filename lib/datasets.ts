import { getDb } from "./db";
import { MONTHS } from "./money";
import { orgNames } from "./names";

export type Dataset = { tab: string; head: string[]; rows: (string | number | null)[][] };
const date = (d?: Date | string | null) => (d ? new Date(d).toISOString().slice(0, 16).replace("T", " ") : "");
const naira = (k?: number | null) => (k === null || k === undefined ? "" : Number((k / 100).toFixed(2)));

export async function buildDataset(kind: "reports" | "remittances" | "attendance"): Promise<Dataset> {
  const db = await getDb();
  const n = await orgNames();
  if (kind === "reports") {
    const [reps, rems] = await Promise.all([db.Report.find().sort({ year: -1, month: -1 }).lean<any[]>(), db.Remittance.find({ kind: "yst" }).lean<any[]>()]);
    const rm = new Map<string, any>(rems.map((r) => [String(r._id), r]));
    return { tab: "Reports", head: ["Level", "Zone", "Area", "Parish", "Month", "Year", "Submitted", "Administrator", "Phone", "Alt phone", "Offering (NGN)", "Required (NGN)", "Remittance status"],
      rows: reps.map((r) => { const m = r.remittance ? rm.get(String(r.remittance)) : null; return [r.type, r.names?.zone ?? "", r.names?.area ?? "", r.names?.parish ?? "", MONTHS[r.month - 1], r.year, date(r.submittedAt), r.contact?.fullName ?? "", r.contact?.phone ?? "", r.contact?.altPhone ?? "", naira(m?.offeringKobo), naira(m?.requiredKobo), m?.status ?? ""]; }) };
  }
  if (kind === "remittances") {
    const rows = await db.Remittance.find().sort({ year: -1, month: -1 }).lean<any[]>();
    // Youth Sunday remittances and other levies are separate rows with a Kind column: never combined.
    return { tab: "Remittances", head: ["Kind", "Zone", "Area", "Parish", "Month", "Year", "Description", "Offering (NGN)", "Percent", "Required (NGN)", "Declared paid (NGN)", "Confirmed (NGN)", "Status", "Paid on", "Reference"],
      rows: rows.map((r) => [r.kind === "yst" ? "Youth Sunday 40%" : "Levy", n.zone.get(String(r.zone)) ?? "", r.area ? n.area.get(String(r.area)) ?? "" : "", n.parish.get(String(r.parish)) ?? "", MONTHS[r.month - 1], r.year, r.description ?? "", naira(r.offeringKobo), r.percentBp ? r.percentBp / 100 : "", naira(r.requiredKobo), naira(r.amountKobo), naira(r.confirmedKobo), r.status, date(r.paidAt), r.reference ?? ""]) };
  }
  const [sessions, counts] = await Promise.all([db.AttendanceSession.find().sort({ date: -1 }).limit(2000).lean<any[]>(), db.Attendance.aggregate([{ $group: { _id: "$session", n: { $sum: 1 }, v: { $sum: { $cond: ["$visitor", 1, 0] } } } }])]);
  const c = new Map<string, any>(counts.map((x: any) => [String(x._id), x]));
  return { tab: "Attendance", head: ["Session", "Type", "Level", "Zone", "Area", "Parish", "Date", "Present", "Visitors"],
    rows: sessions.map((s) => [s.title, s.kind, s.level, s.zone ? n.zone.get(String(s.zone)) ?? "" : "", s.area ? n.area.get(String(s.area)) ?? "" : "", s.parish ? n.parish.get(String(s.parish)) ?? "" : "", date(s.date), c.get(String(s._id))?.n ?? 0, c.get(String(s._id))?.v ?? 0]) };
}
