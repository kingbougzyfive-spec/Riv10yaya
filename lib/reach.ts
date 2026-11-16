/**
 * "Reach": the zones, areas and parishes an administrator is IN CHARGE of.
 *
 * The Super Administrator assigns any number of zones, areas and parishes to an administrator. Everything beneath an assigned zone
 * (its areas and parishes) or an assigned area (its parishes) is automatically under their control. Records carry their whole chain
 * (zone, area, parish), so checking reach never needs the database: a record is in reach if its zone, its area or its parish was assigned.
 *
 * Pure functions, no database, so they can be tested directly. Every place that limits what an administrator can see or change uses these.
 */
export const SCOPED_ROLES = ["zonal_admin", "area_admin", "parish_admin"] as const;
export const isScopedRole = (role: string) => (SCOPED_ROLES as readonly string[]).includes(role);

export type Assignments = { zones: string[]; areas: string[]; parishes: string[] };
export const NO_ASSIGNMENTS: Assignments = { zones: [], areas: [], parishes: [] };

type Who = { role: string; zones?: string[]; areas?: string[]; parishes?: string[] };
const uniq = (a: unknown[] = []) => [...new Set(a.filter(Boolean).map(String))];

export function assignmentsOf(u: Who): Assignments {
  return { zones: uniq(u.zones), areas: uniq(u.areas), parishes: uniq(u.parishes) };
}
export const hasAssignments = (u: Who) => { const a = assignmentsOf(u); return a.zones.length + a.areas.length + a.parishes.length > 0; };

/** One unit stays a plain `{ zone: id }` (exactly what single assignments always produced); several become an $or. */
const one = (k: string, ids: string[]) => (ids.length === 1 ? { [k]: ids[0] } : { [k]: { $in: ids } });

/** Mongo filter for records stamped with zone / area / parish. null = this person has no organisational access at all. */
export function reachFilter(u: Who): Record<string, unknown> | null {
  if (!isScopedRole(u.role)) return null;
  const a = assignmentsOf(u);
  const parts: Record<string, unknown>[] = [];
  if (a.zones.length) parts.push(one("zone", a.zones));
  if (a.areas.length) parts.push(one("area", a.areas));
  if (a.parishes.length) parts.push(one("parish", a.parishes));
  if (!parts.length) return null;
  return parts.length === 1 ? parts[0] : { $or: parts };
}

/** Is a record (or unit) with this chain inside the person's reach? */
export function inReach(u: Who, o: { zone?: unknown; area?: unknown; parish?: unknown }): boolean {
  if (!isScopedRole(u.role)) return false;
  const a = assignmentsOf(u);
  const s = (v: unknown) => (v ? String(v) : "");
  return (!!s(o.zone) && a.zones.includes(s(o.zone))) || (!!s(o.area) && a.areas.includes(s(o.area))) || (!!s(o.parish) && a.parishes.includes(s(o.parish)));
}

/**
 * The single zone / area / parish an assignment list starts with, kept on the user for places that need "the" unit
 * (the parish portal opens on the first parish). Parents come from the unit itself, never from the client.
 */
export function primaryOf(a: Assignments) {
  return { zone: a.zones[0], area: a.areas[0], parish: a.parishes[0] };
}

/**
 * What the screens get to know about the person: their role, and a single zone / area / parish only when they are in charge of exactly one unit.
 * (Every list of zones, areas and parishes already comes from the server limited to their reach, so screens never need to filter again.)
 */
export function meScope(u: Who & { zone?: string; area?: string; parish?: string }) {
  const a = assignmentsOf(u);
  const total = a.zones.length + a.areas.length + a.parishes.length;
  if (total !== 1) return { role: u.role } as { role: string; zone?: string; area?: string; parish?: string };
  return { role: u.role, zone: a.zones[0] ?? (a.areas.length || a.parishes.length ? u.zone : undefined), area: a.areas[0] ?? (a.parishes.length ? u.area : undefined), parish: a.parishes[0] } as { role: string; zone?: string; area?: string; parish?: string };
}
