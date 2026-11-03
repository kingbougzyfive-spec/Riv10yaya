import type { SessionUser } from "./auth";
import { getDb } from "./db";

export const PROVINCIAL = ["super_admin", "finance_admin", "provincial_admin", "auditor"] as const;
export const isProvincial = (u: SessionUser) => (PROVINCIAL as readonly string[]).includes(u.role);

/** Roles allowed to see report-contact phone numbers (never members, never public). */
export const CONTACT_ROLES = ["super_admin", "provincial_admin", "finance_admin", "zonal_admin", "area_admin"] as const;

/**
 * Mongo filter limiting records (reports / remittances) to the user's organisational scope.
 * Returns null when the role has no data access at all.
 */
export async function recordScope(u: SessionUser): Promise<Record<string, unknown> | null> {
  if (isProvincial(u)) return {};
  if (u.role === "zonal_admin" && u.zone) return { zone: u.zone };
  if (u.role === "area_admin" && u.area) return { area: u.area };
  if (u.role === "parish_admin" && u.parish) return { parish: u.parish };
  return null;
}

/** Resolve the full hierarchy path for a parish admin, area admin or zonal admin. */
export async function resolveIdentity(u: SessionUser) {
  const { Zone, Area, Parish } = await getDb();
  if (u.role === "parish_admin" && u.parish) {
    const p = await Parish.findById(u.parish).lean<any>();
    if (!p) return null;
    const [z, a] = await Promise.all([Zone.findById(p.zone).lean<any>(), p.area ? Area.findById(p.area).lean<any>() : null]);
    return { type: "parish" as const, zone: String(p.zone), area: p.area ? String(p.area) : null, parish: String(p._id), names: { zone: z?.name, area: a?.name ?? null, parish: p.name } };
  }
  if (u.role === "area_admin" && u.area) {
    const a = await Area.findById(u.area).lean<any>();
    if (!a) return null;
    const z = await Zone.findById(a.zone).lean<any>();
    return { type: "area" as const, zone: String(a.zone), area: String(a._id), parish: null, names: { zone: z?.name, area: a.name, parish: null } };
  }
  if (u.role === "zonal_admin" && u.zone) {
    const z = await Zone.findById(u.zone).lean<any>();
    if (!z) return null;
    return { type: "zone" as const, zone: String(z._id), area: null, parish: null, names: { zone: z.name, area: null, parish: null } };
  }
  return null;
}
