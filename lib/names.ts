import { getDb } from "./db";

/** id → name lookups for building readable API output. */
export async function orgNames() {
  const { Zone, Area, Parish } = await getDb();
  const [z, a, p] = await Promise.all([Zone.find({}, { name: 1 }).lean<any[]>(), Area.find({}, { name: 1 }).lean<any[]>(), Parish.find({}, { name: 1 }).lean<any[]>()]);
  const mk = (l: any[]) => new Map<string, string>(l.map((x) => [String(x._id), x.name]));
  return { zone: mk(z), area: mk(a), parish: mk(p) };
}

/** Is `target` (zone/area/parish ids) inside the user's organisational scope? Used for create/manage checks. */
export async function inScope(user: { role: string; zone?: string; area?: string; parish?: string }, target: { zone?: any; area?: any; parish?: any }) {
  if (["super_admin", "provincial_admin", "event_admin"].includes(user.role)) return true;
  const { Area, Parish } = await getDb();
  const t = { zone: target.zone ? String(target.zone) : "", area: target.area ? String(target.area) : "", parish: target.parish ? String(target.parish) : "" };
  if (user.role === "zonal_admin") return !!user.zone && t.zone === user.zone;
  if (user.role === "area_admin") {
    if (!user.area) return false;
    if (t.area === user.area) return true;
    if (t.parish) { const p = await Parish.findById(t.parish, { area: 1 }).lean<any>(); return String(p?.area) === user.area; }
    return false;
  }
  if (user.role === "parish_admin") return !!user.parish && t.parish === user.parish;
  void Area;
  return false;
}
