import { handle } from "@/lib/api";
import { ApiError, requireApiUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { PERMS } from "@/lib/rbac";
import { recordScope } from "@/lib/scope";
import { obligationFv, totals } from "@/lib/verification";

export const dynamic = "force-dynamic";

/**
 * Consolidation for a period. Each parish contributes exactly ONE yst remittance to financial totals
 * (unique index enforces this); area and zone figures are just groupings of those same records, so nothing is double-counted.
 * Levies are totalled separately.
 */
export const GET = handle(async (req) => {
  const user = await requireApiUser(PERMS.reports);
  const scope = await recordScope(user);
  if (scope === null) throw new ApiError(403, "No access.");
  const q = new URL(req.url).searchParams;
  const now = new Date();
  const month = Number(q.get("month")) || now.getMonth() + 1;
  const year = Number(q.get("year")) || now.getFullYear();
  const { Zone, Area, Parish, Report, Remittance } = await getDb();

  // Parish docs use _id for the parish scope; the other scope keys are shared field names.
  const pScope: any = { ...scope };
  if (pScope.parish) { pScope._id = pScope.parish; delete pScope.parish; }
  const aScope: any = { ...scope }; delete aScope.parish;

  const [zones, areas, parishes, reports, yst, levies] = await Promise.all([
    Zone.find(scope.zone ? { _id: scope.zone } : { active: true }, { name: 1 }).sort({ name: 1 }).lean<any[]>(),
    Area.find({ ...aScope, active: true }, { name: 1, zone: 1 }).lean<any[]>(),
    Parish.find({ ...pScope, active: true }, { name: 1, zone: 1, area: 1 }).sort({ name: 1 }).lean<any[]>(),
    Report.find({ ...scope, month, year, status: { $ne: "draft" } }, { type: 1, zone: 1, area: 1, parish: 1 }).lean<any[]>(),
    Remittance.find({ ...scope, month, year, kind: "yst" }).lean<any[]>(),
    Remittance.find({ ...scope, month, year, kind: "levy" }).lean<any[]>(),
  ]);

  const zoneIds = new Set(parishes.map((p) => String(p.zone)));
  const sz = Object.keys(scope).length ? zones.filter((z) => zoneIds.has(String(z._id))) : zones;
  const doneP = new Set(reports.filter((r) => r.type === "parish").map((r) => String(r.parish)));
  const doneA = new Set(reports.filter((r) => r.type === "area").map((r) => String(r.area)));
  const doneZ = new Set(reports.filter((r) => r.type === "zone").map((r) => String(r.zone)));
  const sum = (l: any[], k: string) => l.reduce((n, x) => n + (x[k] || 0), 0);
  const byStatus: Record<string, number> = {};
  for (const r of yst) { const k = obligationFv(r); byStatus[k] = (byStatus[k] || 0) + 1; }
  const tot = yst.map((r) => totals(r));
  const confirmedOf = (l: any[]) => l.reduce((n, r) => n + totals(r).confirmedKobo, 0);
  const ystByParish = new Map(yst.map((r) => [String(r.parish), r]));

  return {
    month, year,
    parishes: { total: parishes.length, submitted: parishes.filter((p) => doneP.has(String(p._id))).length },
    areas: { total: areas.length, submitted: areas.filter((a) => doneA.has(String(a._id))).length },
    zones: { total: sz.length, submitted: sz.filter((z) => doneZ.has(String(z._id))).length },
    outstanding: parishes.filter((p) => !doneP.has(String(p._id))).slice(0, 100).map((p) => ({ id: String(p._id), name: p.name, remitted: ystByParish.has(String(p._id)) })),
    finance: {
      offeringKobo: sum(yst, "offeringKobo"),
      requiredKobo: sum(yst, "requiredKobo"),
      declaredKobo: tot.reduce((n, t) => n + t.declaredKobo, 0),
      // Only confirmed money (and audited adjustments) is provincial revenue. Pending, rejected or unverified evidence never counts.
      confirmedKobo: confirmedOf(yst),
      outstandingKobo: tot.reduce((n, t) => n + t.outstandingKobo, 0),
      overpaidKobo: tot.reduce((n, t) => n + t.overpaidKobo, 0),
      parishesWithoutRemittance: parishes.filter((p) => !ystByParish.has(String(p._id))).length,
      byStatus,
    },
    levies: { count: levies.length, totalKobo: sum(levies, "amountKobo"), confirmedKobo: sum(levies.filter((r) => r.status === "confirmed"), "confirmedKobo") },
    byZone: sz.map((z) => {
      const zp = parishes.filter((p) => String(p.zone) === String(z._id));
      const zy = zp.map((p) => ystByParish.get(String(p._id))).filter(Boolean) as any[];
      return { id: String(z._id), name: z.name, parishes: zp.length, submitted: zp.filter((p) => doneP.has(String(p._id))).length, requiredKobo: sum(zy, "requiredKobo"), confirmedKobo: confirmedOf(zy), reportSubmitted: doneZ.has(String(z._id)) };
    }),
  };
});
