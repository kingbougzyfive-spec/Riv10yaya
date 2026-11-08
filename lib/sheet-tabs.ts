import { getDb } from "./db";
import { orgNames } from "./names";
import * as R from "./sheet-rows";
import type { SheetTabKey } from "./sheet-meta";

/** Loads each source once per run and hands the right slice to each tab builder. Contact details are never loaded for registrations. */
export function makeContext() {
  const memo = new Map<string, Promise<any>>();
  const once = <T,>(k: string, f: () => Promise<T>): Promise<T> => { if (!memo.has(k)) memo.set(k, f()); return memo.get(k)!; };
  const db = () => getDb();
  const c = {
    names: () => once("names", () => orgNames()),
    parishes: () => once("parishes", async () => (await db()).Parish.find({}).lean<any[]>()),
    areas: () => once("areas", async () => (await db()).Area.find({}).lean<any[]>()),
    zones: () => once("zones", async () => (await db()).Zone.find({}).lean<any[]>()),
    rems: () => once("rems", async () => (await db()).Remittance.find({}, { history: 0, checks: 0, "payments.history": 0, "payments.checks": 0 }).lean<any[]>()),
    reports: () => once("reports", async () => (await db()).Report.find({}, { history: 0, reviews: 0, rollup: 0 }).lean<any[]>()),
    sessions: () => once("sessions", async () => (await db()).AttendanceSession.find({}, { token: 0, locationCheck: 0 }).lean<any[]>()),
    events: () => once("events", async () => (await db()).Event.find({}, { description: 0, customFields: 0 }).lean<any[]>()),
    counts: () => once("counts", async (): Promise<R.SessionCounts> => {
      const rows = await (await db()).Attendance.aggregate([{ $group: { _id: "$session", total: { $sum: 1 }, visitors: { $sum: { $cond: ["$visitor", 1, 0] } }, qr: { $sum: { $cond: [{ $eq: ["$method", "qr"] }, 1, 0] } } } }]);
      return new Map(rows.map((x: any) => [String(x._id), { total: x.total, visitors: x.visitors, qr: x.qr }]));
    }),
  };
  return c;
}
export type Ctx = ReturnType<typeof makeContext>;

type Builder = (c: Ctx) => Promise<R.Table>;
export const BUILDERS: Record<SheetTabKey, Builder> = {
  parishes: async (c) => { const db = await getDb(); const [p, n, u] = await Promise.all([c.parishes(), c.names(), db.User.find({ role: "parish_admin" }, { name: 1, phone: 1, role: 1, parish: 1, active: 1 }).lean<any[]>()]); return R.parishRegister(p, u, n); },
  submissions: async (c) => { const [r, m, n] = await Promise.all([c.reports(), c.rems(), c.names()]); return R.parishSubmissions(r, m, n); },
  confirmed: async (c) => R.confirmedPayments(await c.rems(), await c.names()),
  outstanding: async (c) => R.outstandingPayments(await c.rems(), await c.names()),
  pending: async (c) => R.pendingVerification(await c.rems(), await c.names()),
  levies: async (c) => R.levyRows(await c.rems(), await c.names(), "levy"),
  contributions: async (c) => R.levyRows(await c.rems(), await c.names(), "contribution"),
  attendance: async (c) => R.parishAttendance(await c.sessions(), await c.counts(), await c.names()),
  areas: async (c) => { const [rems, reports, parishes, areas, zones] = await Promise.all([c.rems(), c.reports(), c.parishes(), c.areas(), c.zones()]); return R.summaries("area", { rems, reports, parishes, areas, zones }); },
  zones: async (c) => { const [rems, reports, parishes, areas, zones] = await Promise.all([c.rems(), c.reports(), c.parishes(), c.areas(), c.zones()]); return R.summaries("zone", { rems, reports, parishes, areas, zones }); },
  province: async (c) => { const [rems, reports, parishes, areas, zones] = await Promise.all([c.rems(), c.reports(), c.parishes(), c.areas(), c.zones()]); return R.summaries("province", { rems, reports, parishes, areas, zones }); },
  registrations: async (c) => {
    const db = await getDb();
    const [events, n] = await Promise.all([c.events(), c.names()]);
    // phone, email and the answers to custom questions are never loaded.
    const regs = await db.Registration.find({}, { phone: 0, phoneKey: 0, email: 0, answers: 0 }).lean<any[]>();
    const ids = [...new Set(regs.filter((r) => r.member).map((r) => String(r.member)))];
    const cutoff = new Date(); cutoff.setFullYear(cutoff.getFullYear() - 18);
    const minors = new Set<string>();
    for (let i = 0; i < ids.length; i += 2000) for (const m of await db.Member.find({ _id: { $in: ids.slice(i, i + 2000) }, dob: { $gt: cutoff } }, { _id: 1 }).lean<any[]>()) minors.add(String(m._id));
    return R.eventRegistrations(regs, events, n, minors);
  },
  eventAttendance: async (c) => {
    const db = await getDb();
    const [events, sessions, counts] = await Promise.all([c.events(), c.sessions(), c.counts()]);
    const agg = await db.Registration.aggregate([{ $group: { _id: "$event", registered: { $sum: { $cond: [{ $eq: ["$status", "registered"] }, 1, 0] } }, cancelled: { $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] } }, checkedIn: { $sum: { $cond: [{ $and: [{ $eq: ["$status", "registered"] }, { $ifNull: ["$checkedInAt", false] }] }, 1, 0] } } } }]);
    return R.eventAttendance(events, new Map(agg.map((x: any) => [String(x._id), x])), sessions, counts);
  },
  activity: async (c) => R.activityReports(await c.reports(), await c.names()),
};
