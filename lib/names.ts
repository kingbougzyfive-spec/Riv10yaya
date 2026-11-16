import { getDb } from "./db";
import { inReach, isScopedRole } from "./reach";

/** id → name lookups for building readable API output. */
export async function orgNames() {
  const { Zone, Area, Parish } = await getDb();
  const [z, a, p] = await Promise.all([Zone.find({}, { name: 1 }).lean<any[]>(), Area.find({}, { name: 1 }).lean<any[]>(), Parish.find({}, { name: 1 }).lean<any[]>()]);
  const mk = (l: any[]) => new Map<string, string>(l.map((x) => [String(x._id), x.name]));
  return { zone: mk(z), area: mk(a), parish: mk(p) };
}

/** Is `target` (zone/area/parish ids) inside what the user is in charge of? Used for create/manage checks. */
export async function inScope(user: { role: string; zones?: string[]; areas?: string[]; parishes?: string[] }, target: { zone?: any; area?: any; parish?: any }) {
  if (["super_admin", "provincial_admin", "event_admin"].includes(user.role)) return true;
  if (!isScopedRole(user.role)) return false;
  const { Area, Parish } = await getDb();
  const t = { zone: target.zone ? String(target.zone) : "", area: target.area ? String(target.area) : "", parish: target.parish ? String(target.parish) : "" };
  // Work out the whole chain from the database, so a target given by one id can't hide its parents.
  if (t.parish && (!t.area || !t.zone)) { const p = await Parish.findById(t.parish, { zone: 1, area: 1 }).lean<any>(); if (p) { t.zone = String(p.zone); t.area = p.area ? String(p.area) : ""; } }
  if (t.area && !t.zone) { const a = await Area.findById(t.area, { zone: 1 }).lean<any>(); if (a) t.zone = String(a.zone); }
  const level = t.parish ? "parish" : t.area ? "area" : "zone";
  if (user.role === "parish_admin" && level !== "parish") return false;
  if (user.role === "area_admin" && level === "zone") return false;
  return inReach(user, t);
}
