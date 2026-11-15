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

/**
 * People pick ONE thing that matches what they lead: a zone, an area or a parish. This finds it and works out the rest of its chain.
 * Returns null when nothing valid was picked (the pick is optional).
 */
export async function chainFor(level: "zone" | "area" | "parish", id?: string | null) {
  if (!id) return null;
  const { Zone, Area, Parish } = await getDb();
  if (level === "zone") {
    const zone: any = await Zone.findOne({ _id: id, active: true }).lean();
    return zone ? { zone, area: null as any, parish: null as any, unit: zone } : null;
  }
  if (level === "area") {
    const area: any = await Area.findOne({ _id: id, active: true }).lean();
    const zone: any = area ? await Zone.findById(area.zone).lean() : null;
    return area && zone ? { zone, area, parish: null as any, unit: area } : null;
  }
  const parish: any = await Parish.findOne({ _id: id, active: true }).lean();
  const [zone, area]: any[] = parish ? await Promise.all([Zone.findById(parish.zone).lean(), parish.area ? Area.findById(parish.area).lean() : null]) : [null, null];
  return parish && zone ? { zone, area: area ?? null, parish, unit: parish } : null;
}
