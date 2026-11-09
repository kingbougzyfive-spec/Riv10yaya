import { ApiError, type SessionUser } from "./auth";
import { getDb } from "./db";
import { recordScope } from "./scope";
import type { Area, Data } from "./ai-core";

/**
 * Loads data for the assistant. Every query is cut down to the signed-in person's organisational scope here, in code,
 * before the AI sees anything. The model can ask for a zone or area by name but can never widen its own view.
 */
export async function makeLoader(user: SessionUser) {
  const scope: any = await recordScope(user);
  if (scope === null) throw new ApiError(403, "Your role doesn't have access to organisation records.");
  const db = await getDb();
  const memo = new Map<string, Promise<any>>();
  const once = <T,>(k: string, f: () => Promise<T>): Promise<T> => { if (!memo.has(k)) memo.set(k, f()); return memo.get(k)!; };
  const pf: any = scope.zone ? { zone: scope.zone } : scope.area ? { area: scope.area } : scope.parish ? { _id: scope.parish } : {};

  const parishes = () => once<any[]>("parishes", () => db.Parish.find(pf).lean<any[]>());
  const zones = () => once<any[]>("zones", () => db.Zone.find({}, { name: 1, active: 1 }).lean<any[]>());
  const areas = () => once<any[]>("areas", () => db.Area.find({}, { name: 1, zone: 1, active: 1 }).lean<any[]>());

  const L = {
    scope, parishes, zones, areas,
    rems: (years: number[]) => once<any[]>(`rems${years}`, () => db.Remittance.find({ year: { $in: years }, ...scope }, { history: 0, checks: 0, "payments.history": 0, "payments.checks": 0 }).lean<any[]>()),
    reports: (years: number[]) => once<any[]>(`rep${years}`, () => db.Report.find({ year: { $in: years }, ...scope }, { history: 0, reviews: 0, rollup: 0, contact: 0 }).lean<any[]>()),
    sessions: (years: number[]) => once<any[]>(`ses${years}`, () => db.AttendanceSession.find({ date: { $gte: new Date(Date.UTC(Math.min(...years), 0, 1) - 86400_000), $lt: new Date(Date.UTC(Math.max(...years) + 1, 0, 2)) }, ...scope }, { token: 0, locationCheck: 0 }).lean<any[]>()),
    counts: async (sessionIds: any[]) => {
      const rows = sessionIds.length ? await db.Attendance.aggregate([{ $match: { session: { $in: sessionIds } } }, { $group: { _id: "$session", total: { $sum: 1 }, visitors: { $sum: { $cond: ["$visitor", 1, 0] } } } }]) : [];
      return new Map<string, { total: number; visitors: number }>(rows.map((x: any) => [String(x._id), { total: x.total, visitors: x.visitors }]));
    },
    reviewed: (start: Date, end: Date) => once<any[]>(`rv${+start}`, () => db.Remittance.find({ ...scope, $or: [{ reviewedAt: { $gte: start, $lt: end } }, { "payments.reviewedAt": { $gte: start, $lt: end } }] }, { history: 0, checks: 0, "payments.history": 0, "payments.checks": 0 }).lean<any[]>()),
    async scopeLabel() {
      const z = await zones(), a = await areas(), p = await parishes();
      if (scope.zone) return `Zone: ${z.find((x) => String(x._id) === String(scope.zone))?.name ?? ""}`;
      if (scope.area) return `Area: ${a.find((x) => String(x._id) === String(scope.area))?.name ?? ""}`;
      if (scope.parish) return `Parish: ${p[0]?.name ?? ""}`;
      return "Whole province";
    },
    /** Zone/area given by name → ids, but only ones that exist inside this person's own scope. */
    async resolve(zone?: string, area?: string): Promise<Area> {
      const out: Area = {};
      const ps = await parishes(), z = await zones(), a = await areas();
      const find = (list: any[], ids: Set<string>, name: string, what: string) => {
        const n = name.trim().toLowerCase();
        const vis = list.filter((x) => ids.has(String(x._id)));
        const hit = vis.filter((x) => x.name.toLowerCase() === n); const part = hit.length ? hit : vis.filter((x) => x.name.toLowerCase().includes(n));
        if (!part.length) throw new Error(`No ${what} matching “${name}” in this person's access.`);
        if (part.length > 1) throw new Error(`“${name}” matches several ${what}s: ${part.map((x) => x.name).join(", ")}. Ask which one.`);
        return String(part[0]._id);
      };
      if (zone) out.zone = find(z, new Set(ps.map((p) => String(p.zone))), zone, "zone");
      if (area) out.area = find(a, new Set(ps.filter((p) => p.area).map((p) => String(p.area))), area, "area");
      return out;
    },
  };
  return L;
}
export type Loader = Awaited<ReturnType<typeof makeLoader>>;
export type { Data };
