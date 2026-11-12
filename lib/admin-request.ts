import { keyOf } from "./api";
import { getDb } from "./db";

export type Typed = { level: "zone" | "area" | "parish"; zoneName?: string; areaName?: string; parishName?: string; zone?: any; area?: any; parish?: any };

/** Finds the existing zone, area and parish that the typed names refer to (exact name, ignoring capitals and extra spaces). */
export async function matchTyped(r: Typed, over: { zone?: string; area?: string; parish?: string } = {}) {
  const { Zone, Area, Parish } = await getDb();
  const zone: any = over.zone ? await Zone.findById(over.zone).lean()
    : r.zone ? await Zone.findById(r.zone).lean()
    : r.zoneName ? await Zone.findOne({ nameKey: keyOf(r.zoneName) }).lean() : null;
  let area: any = null, parish: any = null;
  if (zone && zone.hasAreas && r.level !== "zone") {
    area = over.area ? await Area.findOne({ _id: over.area, zone: zone._id }).lean()
      : r.area ? await Area.findOne({ _id: r.area, zone: zone._id }).lean()
      : r.areaName ? await Area.findOne({ zone: zone._id, nameKey: keyOf(r.areaName) }).lean() : null;
  }
  if (zone && r.level === "parish" && (area || !zone.hasAreas)) {
    const where = { zone: zone._id, area: zone.hasAreas ? area?._id : null };
    parish = over.parish ? await Parish.findOne({ _id: over.parish, ...where }).lean()
      : r.parish ? await Parish.findOne({ _id: r.parish, ...where }).lean()
      : r.parishName ? await Parish.findOne({ ...where, nameKey: keyOf(r.parishName) }).lean() : null;
  }
  return { zone, area, parish };
}
