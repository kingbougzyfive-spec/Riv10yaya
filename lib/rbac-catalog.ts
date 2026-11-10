import { PERMS } from "./rbac";
import { ROLES, ROLE_LABELS, type Role } from "./roles";

const LEVEL: Record<Role, string> = {
  super_admin: "province", finance_admin: "province", provincial_admin: "province", auditor: "read_only",
  zonal_admin: "zone", area_admin: "area", parish_admin: "parish", event_admin: "event", department_admin: "department", member: "member",
};

/** The catalogue derived from code. Pure, so it can be tested and compared with the stored rows. */
export function catalog() {
  const perms = Object.entries(PERMS).map(([key, roles]) => ({ key, roles: [...roles as readonly string[]] }));
  const roles = ROLES.map((key) => ({ key, label: ROLE_LABELS[key], level: LEVEL[key], permissions: perms.filter((p) => p.roles.includes(key)).map((p) => p.key) }));
  return { roles, perms };
}

/** Keeps the Role and Permission collections in step with lib/rbac.ts. The rows describe access; they never grant it:
 *  every route checks the code lists, so editing these rows changes nothing about what anyone can do. */
export async function syncRbacCatalog(db: { Role: any; Permission: any }) {
  const { roles, perms } = catalog();
  await Promise.all([
    ...roles.map((r) => db.Role.updateOne({ key: r.key }, { $set: { label: r.label, level: r.level, permissions: r.permissions, system: true } }, { upsert: true })),
    ...perms.map((p) => db.Permission.updateOne({ key: p.key }, { $set: { roles: p.roles }, $setOnInsert: { description: `Allowed for: ${p.roles.join(", ")}` } }, { upsert: true })),
  ]);
  return { roles: roles.length, permissions: perms.length };
}
