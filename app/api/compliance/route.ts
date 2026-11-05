import { handle } from "@/lib/api";
import { ApiError, requireApiUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { PERMS } from "@/lib/rbac";
import { recordScope } from "@/lib/scope";
import { FV_LABEL, compliance, obligationFv, totals, type ReportStatus } from "@/lib/verification";

export const dynamic = "force-dynamic";

/**
 * Overall compliance per parish for a month, derived from two independent facts: the monthly report's status
 * and the financial verification of the remittance. Only confirmed money counts as paid.
 */
export const GET = handle(async (req) => {
  const user = await requireApiUser(PERMS.reports);
  const scope = await recordScope(user);
  if (scope === null) throw new ApiError(403, "No access.");
  const q = new URL(req.url).searchParams;
  const now = new Date();
  const month = Number(q.get("month")) || now.getMonth() + 1;
  const year = Number(q.get("year")) || now.getFullYear();
  const { Parish, Zone, Area, Report, Remittance } = await getDb();
  const pScope: any = { ...scope };
  if (pScope.parish) { pScope._id = pScope.parish; delete pScope.parish; }
  for (const k of ["zone", "area"]) if (q.get(k)) { if (pScope[k] && String(pScope[k]) !== q.get(k)) return { month, year, rows: [], counts: {} }; pScope[k] = q.get(k); }
  const [parishes, zones, areas, reports, rems] = await Promise.all([
    Parish.find({ ...pScope, active: true }, { name: 1, zone: 1, area: 1 }).sort({ name: 1 }).lean<any[]>(),
    Zone.find({}, { name: 1 }).lean<any[]>(), Area.find({}, { name: 1 }).lean<any[]>(),
    Report.find({ ...scope, type: "parish", month, year }, { parish: 1, status: 1, reportId: 1 }).lean<any[]>(),
    Remittance.find({ ...scope, kind: "yst", month, year }).lean<any[]>(),
  ]);
  const zn = new Map(zones.map((x) => [String(x._id), x.name])), an = new Map(areas.map((x) => [String(x._id), x.name]));
  const rep = new Map<string, any>(reports.map((r) => [String(r.parish), r])), rem = new Map<string, any>(rems.map((r) => [String(r.parish), r]));
  const counts: Record<string, number> = {};
  const rows = parishes.map((p) => {
    const r = rep.get(String(p._id)), m = rem.get(String(p._id));
    const reportStatus = (r?.status ?? "not_started") as ReportStatus;
    const c = compliance(reportStatus, m);
    counts[c.code] = (counts[c.code] || 0) + 1;
    const t = totals(m);
    return { id: String(p._id), parish: p.name, zone: zn.get(String(p.zone)), area: p.area ? an.get(String(p.area)) : null, reportStatus, reportId: r?.reportId ?? null, fv: obligationFv(m), fvLabel: FV_LABEL[obligationFv(m)], requiredKobo: t.requiredKobo, confirmedKobo: t.confirmedKobo, outstandingKobo: t.outstandingKobo, overpaidKobo: t.overpaidKobo, compliance: c };
  });
  const want = q.get("code");
  return { month, year, counts, rows: want ? rows.filter((r) => r.compliance.code === want) : rows };
});
