import type { Role } from "./roles";

/** Who may do what. Enforced in every route handler via requireApiUser(...). */
export const PERMS = {
  adminArea: ["super_admin", "finance_admin", "provincial_admin", "zonal_admin", "area_admin", "parish_admin", "event_admin", "department_admin", "auditor"],
  siteEdit: ["super_admin", "provincial_admin"],
  media: ["super_admin", "provincial_admin", "event_admin"],
  orgManage: ["super_admin", "provincial_admin"],
  orgView: ["super_admin", "finance_admin", "provincial_admin", "zonal_admin", "area_admin", "parish_admin", "auditor"],
  users: ["super_admin"],
  reports: ["super_admin", "finance_admin", "provincial_admin", "zonal_admin", "area_admin", "parish_admin", "auditor"],
  reportSubmit: ["zonal_admin", "area_admin", "parish_admin"],
  finance: ["super_admin", "finance_admin", "provincial_admin", "zonal_admin", "area_admin", "parish_admin", "auditor"],
  financeReview: ["super_admin", "finance_admin"],
  percentEdit: ["super_admin", "provincial_admin"],
  bankEdit: ["super_admin", "finance_admin"],
  events: ["super_admin", "provincial_admin", "event_admin"],
  attendance: ["super_admin", "provincial_admin", "event_admin", "zonal_admin", "area_admin", "parish_admin"],
  attendanceView: ["super_admin", "provincial_admin", "event_admin", "zonal_admin", "area_admin", "parish_admin", "auditor"],
  members: ["super_admin", "provincial_admin", "zonal_admin", "area_admin", "parish_admin"],
  content: ["super_admin", "provincial_admin"],
  integrations: ["super_admin", "provincial_admin", "finance_admin"],
  database: ["super_admin"],
  comms: ["super_admin", "provincial_admin", "zonal_admin", "area_admin", "parish_admin", "event_admin"],
  /** Ask questions about records: only roles with a defined organisational scope, and answers are cut to that scope. */
  assistant: ["super_admin", "finance_admin", "provincial_admin", "zonal_admin", "area_admin", "parish_admin", "auditor"],
  /** Draft announcements and notices (the human still reviews and sends). Same people who can use Communications. */
  aiWrite: ["super_admin", "provincial_admin", "zonal_admin", "area_admin", "parish_admin", "event_admin"],
  /** Anyone who may use either half of the assistant (for the menu and the page). */
  aiAny: ["area_admin", "auditor", "event_admin", "finance_admin", "parish_admin", "provincial_admin", "super_admin", "zonal_admin"],
  governance: ["super_admin", "provincial_admin", "zonal_admin", "area_admin", "parish_admin", "auditor"],
  governanceManage: ["super_admin", "provincial_admin", "zonal_admin", "area_admin", "parish_admin"],
  audit: ["super_admin", "auditor"],
} as const satisfies Record<string, readonly Role[]>;

export const can = (role: Role, perm: keyof typeof PERMS) => (PERMS[perm] as readonly Role[]).includes(role);
