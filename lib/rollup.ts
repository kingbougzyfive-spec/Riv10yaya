import { getDb } from "./db";

/** Server-side consolidation. Counts only; money is never summed here so nothing can be double-counted. */
export async function areaRollup(areaId: string, month: number, year: number) {
  const { Parish, Report } = await getDb();
  const parishes = await Parish.find({ area: areaId, active: true }, { name: 1 }).sort({ name: 1 }).lean<any[]>();
  const done = new Set((await Report.find({ type: "parish", area: areaId, month, year, status: { $ne: "draft" } }, { parish: 1 }).lean<any[]>()).map((r) => String(r.parish)));
  return {
    parishes: parishes.map((p) => ({ id: String(p._id), name: p.name, submitted: done.has(String(p._id)) })),
    parishCount: parishes.length,
    submittedParishReports: parishes.filter((p) => done.has(String(p._id))).length,
    outstandingParishReports: parishes.filter((p) => !done.has(String(p._id))).length,
  };
}

export async function zoneRollup(zoneId: string, month: number, year: number) {
  const { Area, Parish, Report } = await getDb();
  const [areas, parishes, parishReports, areaReports] = await Promise.all([
    Area.find({ zone: zoneId, active: true }, { name: 1 }).sort({ name: 1 }).lean<any[]>(),
    Parish.find({ zone: zoneId, active: true }, { name: 1, area: 1 }).sort({ name: 1 }).lean<any[]>(),
    Report.find({ type: "parish", zone: zoneId, month, year, status: { $ne: "draft" } }, { parish: 1 }).lean<any[]>(),
    Report.find({ type: "area", zone: zoneId, month, year, status: { $ne: "draft" } }, { area: 1 }).lean<any[]>(),
  ]);
  const pDone = new Set(parishReports.map((r) => String(r.parish)));
  const aDone = new Set(areaReports.map((r) => String(r.area)));
  const direct = parishes.filter((p) => !p.area);
  return {
    areas: areas.map((a) => ({ id: String(a._id), name: a.name, submitted: aDone.has(String(a._id)) })),
    directParishes: direct.map((p) => ({ id: String(p._id), name: p.name, submitted: pDone.has(String(p._id)) })),
    areaCount: areas.length,
    directParishCount: direct.length,
    totalParishes: parishes.length,
    submittedParishReports: parishes.filter((p) => pDone.has(String(p._id))).length,
    outstandingParishReports: parishes.filter((p) => !pDone.has(String(p._id))).length,
    submittedAreaReports: areas.filter((a) => aDone.has(String(a._id))).length,
    outstandingAreaReports: areas.filter((a) => !aDone.has(String(a._id))).length,
  };
}
