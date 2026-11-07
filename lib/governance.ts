/**
 * Governance rules: which organisational level a record belongs to, who may see it and who may change it.
 * Pure helpers (no database) so the access rules can be tested on their own.
 */
export const LEVELS = ["province", "zone", "area", "parish"] as const;
export type GLevel = (typeof LEVELS)[number];
export const LEVEL_LABEL: Record<GLevel, string> = { province: "Province", zone: "Zone", area: "Area", parish: "Parish" };

export type Org = { level: GLevel; zone?: string | null; area?: string | null; parish?: string | null };
export type Actor = { role: string; zone?: string; area?: string; parish?: string };

const s = (v: unknown) => (v ? String(v) : "");
export const PROVINCIAL_ROLES = ["super_admin", "provincial_admin"] as const;
export const isProvincialAdmin = (role: string) => (PROVINCIAL_ROLES as readonly string[]).includes(role);

/** Suggested position titles per level (free text is still allowed). */
export const POSITIONS: Record<GLevel, string[]> = {
  province: ["Provincial Youth President", "Vice President", "Provincial Secretary", "Assistant Secretary", "Provincial Treasurer", "Financial Secretary", "Provincial Youth Chaplain", "Provincial Coordinator", "Provincial Patron"],
  zone: ["Zonal Youth President", "Zonal Vice President", "Zonal Secretary", "Zonal Treasurer", "Zonal Youth Chaplain", "Zonal Coordinator"],
  area: ["Area Youth President", "Area Vice President", "Area Secretary", "Area Treasurer", "Area Youth Chaplain", "Area Coordinator"],
  parish: ["Parish Youth President", "Parish Vice President", "Parish Secretary", "Parish Treasurer", "Parish Youth Chaplain", "Parish Coordinator"],
};
export const COMMITTEE_ROLES = ["chair", "vice_chair", "secretary", "treasurer", "member"] as const;
export const COMMITTEE_ROLE_LABEL: Record<string, string> = { chair: "Chairperson", vice_chair: "Vice chairperson", secretary: "Secretary", treasurer: "Treasurer", member: "Member" };

/** Does the org record carry the ids its level requires, and no deeper ones? */
export function orgComplete(o: Org) {
  if (o.level === "province") return true;
  if (o.level === "zone") return !!o.zone;
  if (o.level === "area") return !!o.zone && !!o.area;
  return !!o.zone && !!o.parish;
}

/** Mongo filter of the records a user may SEE. Higher levels see everything beneath them, never the reverse. */
export function visibleFilter(u: Actor): Record<string, unknown> | null {
  if (["super_admin", "provincial_admin", "auditor"].includes(u.role)) return {};
  if (u.role === "zonal_admin" && u.zone) return { zone: u.zone };
  if (u.role === "area_admin" && u.area) return { area: u.area };
  if (u.role === "parish_admin" && u.parish) return { parish: u.parish };
  return null;
}

/** May this user see a record that belongs to `o`? (the same rule as visibleFilter, for a single record) */
export function canView(u: Actor, o: Org) {
  if (["super_admin", "provincial_admin", "auditor"].includes(u.role)) return true;
  if (u.role === "zonal_admin") return !!u.zone && s(o.zone) === u.zone;
  if (u.role === "area_admin") return !!u.area && s(o.area) === u.area;
  if (u.role === "parish_admin") return !!u.parish && s(o.parish) === u.parish;
  return false;
}

/**
 * May this user CREATE or CHANGE a record at `o`? Admins manage their own level and the levels below it,
 * never a level above (an area admin cannot manage the zone's committees). Province-level records: provincial admins only.
 */
export function canManage(u: Actor, o: Org) {
  if (isProvincialAdmin(u.role)) return true;
  if (o.level === "province") return false;
  if (u.role === "zonal_admin") return !!u.zone && s(o.zone) === u.zone;
  if (u.role === "area_admin") return !!u.area && (o.level === "area" || o.level === "parish") && s(o.area) === u.area;
  if (u.role === "parish_admin") return !!u.parish && o.level === "parish" && s(o.parish) === u.parish;
  return false;
}

/** A member sits inside an org if they belong to its zone / area / parish. Province contains everyone. */
export function memberWithin(o: Org, m: { zone?: unknown; area?: unknown; parish?: unknown }) {
  if (o.level === "province") return true;
  if (o.level === "zone") return s(m.zone) === s(o.zone);
  if (o.level === "area") return s(m.area) === s(o.area);
  return s(m.parish) === s(o.parish);
}

/** Highest levels an actor can create items at. */
export function creatableLevels(role: string): GLevel[] {
  if (isProvincialAdmin(role)) return ["province", "zone", "area", "parish"];
  if (role === "zonal_admin") return ["zone", "area", "parish"];
  if (role === "area_admin") return ["area", "parish"];
  if (role === "parish_admin") return ["parish"];
  return [];
}

export type TaskLike = { status: string; dueAt?: Date | string | null };
export const TASK_STATUSES = ["open", "in_progress", "done", "cancelled"] as const;
export const isOverdue = (t: TaskLike, now = new Date()) => (t.status === "open" || t.status === "in_progress") && !!t.dueAt && new Date(t.dueAt).getTime() < now.getTime();
export function taskStats(tasks: TaskLike[], now = new Date()) {
  const n = (f: (t: TaskLike) => boolean) => tasks.filter(f).length;
  const total = tasks.filter((t) => t.status !== "cancelled").length;
  const done = n((t) => t.status === "done");
  return { total, open: n((t) => t.status === "open"), inProgress: n((t) => t.status === "in_progress"), done, overdue: n((t) => isOverdue(t, now)), pct: total ? Math.round((done / total) * 100) : 0 };
}

export const DOC_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "text/plain": "txt", "image/png": "png", "image/jpeg": "jpg",
};
export const DOC_MAX = 6 * 1024 * 1024;

/** Attendance summary for a meeting. */
export function attendanceStats(rows: { status: string }[]) {
  const present = rows.filter((r) => r.status === "present").length, apology = rows.filter((r) => r.status === "apology").length;
  return { total: rows.length, present, apology, absent: rows.length - present - apology, pct: rows.length ? Math.round((present / rows.length) * 100) : 0 };
}
