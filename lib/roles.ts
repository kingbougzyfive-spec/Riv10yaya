export const ROLES = [
  "super_admin",
  "finance_admin",
  "provincial_admin",
  "zonal_admin",
  "area_admin",
  "parish_admin",
  "event_admin",
  "department_admin",
  "member",
  "auditor",
] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: "Provincial Super Administrator",
  finance_admin: "Provincial Finance Administrator",
  provincial_admin: "Provincial Administrator",
  zonal_admin: "Zonal Administrator",
  area_admin: "Area Administrator",
  parish_admin: "Parish Administrator",
  event_admin: "Event Administrator",
  department_admin: "Department Administrator",
  member: "Member",
  auditor: "Read-only Auditor",
};

