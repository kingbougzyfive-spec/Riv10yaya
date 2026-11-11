/** Pure scoping rules (no database), so they can be tested directly. */
/** Roles allowed to see report-contact phone numbers (never members, never public). */
export const CONTACT_ROLES = ["super_admin", "provincial_admin", "finance_admin", "zonal_admin", "area_admin"] as const;

/**
 * Administrator contact details on a report: provincial/zonal/area roles (already limited to their own scope by
 * recordScope) and the parish's own administrator. Members, auditors, event admins and the public never.
 */
export function canSeeContact(user: { role: string; parish?: string | null }, report: { parish?: unknown }): boolean {
  if ((CONTACT_ROLES as readonly string[]).includes(user.role)) return true;
  return user.role === "parish_admin" && !!user.parish && String(report.parish) === user.parish;
}

const NO_MATCH = "000000000000000000000000";
const isOid = (v: string | null): v is string => !!v && /^[a-f0-9]{24}$/i.test(v);
/**
 * Applies a zone/area/parish chosen in a filter on top of the person's own scope. A choice outside their scope
 * matches nothing (never more), so a filter can narrow a view but can never widen it.
 */
export function clampScope(scope: Record<string, any>, q: URLSearchParams, keys: ("zone" | "area" | "parish")[] = ["zone", "area", "parish"]) {
  const f: Record<string, any> = { ...scope };
  for (const k of keys) { const v = q.get(k); if (!isOid(v)) continue; f[k] = f[k] && String(f[k]) !== v ? NO_MATCH : v; }
  return f;
}
