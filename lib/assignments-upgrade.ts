import { getDbRaw } from "./db";
import { SCOPED_ROLES } from "./reach";

/**
 * Before several assignments existed, a zonal, area or parish administrator held ONE unit in zone / area / parish. This copies that unit
 * into the new assignment lists (zones / areas / parishes) once, so nobody loses access and queries only ever need the lists.
 * Safe to run any number of times: it only touches accounts that have no lists yet.
 */
export async function upgradeAssignments() {
  const { User } = await getDbRaw();
  const todo = { role: { $in: [...SCOPED_ROLES] }, zones: { $exists: false }, areas: { $exists: false }, parishes: { $exists: false } };
  if (!(await User.exists(todo))) return 0;
  const pick = (role: string, field: string) => ({ $cond: [{ $and: [{ $eq: ["$role", role] }, { $ne: [{ $ifNull: [`$${field}`, null] }, null] }] }, [`$${field}`], []] });
  const r = await User.collection.updateMany(todo, [{ $set: { zones: pick("zonal_admin", "zone"), areas: pick("area_admin", "area"), parishes: pick("parish_admin", "parish") } }]);
  return r.modifiedCount;
}
