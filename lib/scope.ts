import type { SessionUser } from "./auth";
import { getDb } from "./db";
export { CONTACT_ROLES, canSeeContact, clampScope } from "./scope-core";
import { assignmentsOf, reachFilter } from "./reach";

export const PROVINCIAL = ["super_admin", "finance_admin", "provincial_admin", "auditor"] as const;
export const isProvincial = (u: SessionUser) => (PROVINCIAL as readonly string[]).includes(u.role);

/**
 * Mongo filter limiting records (reports / remittances / members / attendance ...) to what the user is IN CHARGE of: every zone, area and
 * parish assigned to them, plus everything beneath those (records carry their whole chain, see lib/reach.ts).
 * One assigned unit gives a plain `{ zone: id }` filter; several give an `$or`. Returns null when the role has no data access at all.
 */
export async function recordScope(u: SessionUser): Promise<Record<string, unknown> | null> {
  if (isProvincial(u)) return {};
  return reachFilter(u);
}

/** Resolve the full hierarchy path for the unit a parish, area or zonal administrator is working on (their first assigned one unless `pick` names another they are in charge of). */
export async function resolveIdentity(u: SessionUser, pick: { zone?: string; area?: string; parish?: string } = {}) {
  const { Zone, Area, Parish } = await getDb();
  const choose = (list: string[], want: string | undefined, legacy: string | undefined) => (want && list.includes(want) ? want : list[0] ?? legacy);
  if (u.role === "parish_admin") {
    const id = choose(u.parishes, pick.parish, u.parish);
    if (!id) return null;
    const p = await Parish.findById(id).lean<any>();
    if (!p) return null;
    const [z, a] = await Promise.all([Zone.findById(p.zone).lean<any>(), p.area ? Area.findById(p.area).lean<any>() : null]);
    return { type: "parish" as const, zone: String(p.zone), area: p.area ? String(p.area) : null, parish: String(p._id), names: { zone: z?.name, area: a?.name ?? null, parish: p.name } };
  }
  if (u.role === "area_admin") {
    const id = choose(u.areas, pick.area, u.area);
    if (!id) return null;
    const a = await Area.findById(id).lean<any>();
    if (!a) return null;
    const z = await Zone.findById(a.zone).lean<any>();
    return { type: "area" as const, zone: String(a.zone), area: String(a._id), parish: null, names: { zone: z?.name, area: a.name, parish: null } };
  }
  if (u.role === "zonal_admin") {
    const id = choose(u.zones, pick.zone, u.zone);
    if (!id) return null;
    const z = await Zone.findById(id).lean<any>();
    if (!z) return null;
    return { type: "zone" as const, zone: String(z._id), area: null, parish: null, names: { zone: z.name, area: null, parish: null } };
  }
  return null;
}

/**
 * Everything the user is in charge of, written out unit by unit: the assigned zones, areas and parishes plus all that lie beneath them,
 * and the parents of assigned areas and parishes (so they can see where their units sit). Used to build org lists and drop-downs.
 */
export async function reachUnits(u: SessionUser) {
  const { Zone, Area, Parish } = await getDb();
  const a = assignmentsOf(u);
  const [areasIn, parishesIn, areaDocs, parishDocs] = await Promise.all([
    a.zones.length ? Area.find({ zone: { $in: a.zones } }, { _id: 1, zone: 1 }).lean<any[]>() : [],
    a.zones.length || a.areas.length ? Parish.find({ $or: [...(a.zones.length ? [{ zone: { $in: a.zones } }] : []), ...(a.areas.length ? [{ area: { $in: a.areas } }] : [])] }, { _id: 1, zone: 1, area: 1 }).lean<any[]>() : [],
    a.areas.length ? Area.find({ _id: { $in: a.areas } }, { _id: 1, zone: 1 }).lean<any[]>() : [],
    a.parishes.length ? Parish.find({ _id: { $in: a.parishes } }, { _id: 1, zone: 1, area: 1 }).lean<any[]>() : [],
  ]);
  const zones = new Set<string>(a.zones);
  const areas = new Set<string>([...a.areas, ...areasIn.map((x) => String(x._id))]);
  const parishes = new Set<string>([...a.parishes, ...parishesIn.map((x) => String(x._id))]);
  for (const x of [...areaDocs, ...parishDocs]) { zones.add(String(x.zone)); if (x.area) areas.add(String(x.area)); }
  for (const x of parishesIn) { if (x.area) areas.add(String(x.area)); zones.add(String(x.zone)); }
  void Zone;
  return { zones: [...zones], areas: [...areas], parishes: [...parishes] };
}

/**
 * Filters for the zone / area / parish collections themselves (not the records stamped with them): provincial roles get everything,
 * everyone else gets exactly the units they are in charge of, those beneath them and the parents above them.
 */
export async function orgFilters(u: SessionUser) {
  if (isProvincial(u)) return { zone: {}, area: {}, parish: {} } as Record<"zone" | "area" | "parish", Record<string, unknown>>;
  const r = await reachUnits(u);
  return { zone: { _id: { $in: r.zones } }, area: { _id: { $in: r.areas } }, parish: { _id: { $in: r.parishes } } } as Record<"zone" | "area" | "parish", Record<string, unknown>>;
}

/** A short human label for what someone is in charge of, e.g. "Zone: City of Praise" or "3 zones, 2 areas". */
export async function scopeLabelOf(u: SessionUser) {
  if (isProvincial(u)) return "Whole province";
  const a = assignmentsOf(u);
  const total = a.zones.length + a.areas.length + a.parishes.length;
  if (!total) return "No units assigned";
  const { Zone, Area, Parish } = await getDb();
  if (total === 1) {
    if (a.zones.length) return `Zone: ${(await Zone.findById(a.zones[0], { name: 1 }).lean<any>())?.name ?? ""}`;
    if (a.areas.length) return `Area: ${(await Area.findById(a.areas[0], { name: 1 }).lean<any>())?.name ?? ""}`;
    return `Parish: ${(await Parish.findById(a.parishes[0], { name: 1 }).lean<any>())?.name ?? ""}`;
  }
  const bits = [a.zones.length && `${a.zones.length} zone${a.zones.length > 1 ? "s" : ""}`, a.areas.length && `${a.areas.length} area${a.areas.length > 1 ? "s" : ""}`, a.parishes.length && `${a.parishes.length} parish${a.parishes.length > 1 ? "es" : ""}`].filter(Boolean);
  return bits.join(", ");
}
