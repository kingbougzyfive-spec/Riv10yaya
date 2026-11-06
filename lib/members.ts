/** Client-safe member rules: age, privacy of minors, categories, and the change log. */

export const MEMBER_STATUSES = ["active", "inactive", "visitor", "transferred"] as const;
export type MemberStatus = (typeof MEMBER_STATUSES)[number];
export const STATUS_LABEL: Record<MemberStatus, string> = { active: "Active", inactive: "Inactive", visitor: "Visitor", transferred: "Transferred" };
export const FOLLOW_KINDS = ["call", "visit", "message", "meeting", "other"] as const;

export type Category = { key: string; label: string; active: boolean };
export const DEFAULT_CATEGORIES: Category[] = ["Teenager", "Youth", "Young adult", "Worker", "Leader", "Visitor"].map((l) => ({ key: l.toLowerCase().replace(/\s+/g, "_"), label: l, active: true }));

/** Whole years on `at`; null when the date of birth is unknown. */
export function ageOn(dob: Date | string | null | undefined, at: Date = new Date()): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  let a = at.getFullYear() - d.getFullYear();
  if (at.getMonth() < d.getMonth() || (at.getMonth() === d.getMonth() && at.getDate() < d.getDate())) a--;
  return a;
}
export const isMinor = (dob: Date | string | null | undefined, at?: Date) => { const a = ageOn(dob, at); return a !== null && a < 18; };

/** Roles that may see a minor's personal and contact details. Others get a minimal, non-identifying-by-contact view. */
export const MINOR_FULL_ROLES = ["super_admin", "parish_admin"] as const;
export const FOLLOWUP_ROLES = ["super_admin", "provincial_admin", "zonal_admin", "area_admin", "parish_admin"] as const;
export const canSeeMinor = (role: string) => (MINOR_FULL_ROLES as readonly string[]).includes(role);
export const canFollowUp = (role: string) => (FOLLOWUP_ROLES as readonly string[]).includes(role);

/** Fields whose changes are written to the member's change log. */
export const TRACKED = ["name", "phone", "email", "dob", "gender", "category", "status", "parish", "area", "zone", "joinedAt", "leadership", "departments", "guardian"] as const;

const norm = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
};
/** Differences between the stored value and the proposed one for tracked fields. */
export function diffTracked(before: Record<string, unknown>, after: Record<string, unknown>) {
  const out: { field: string; from: string; to: string }[] = [];
  for (const f of TRACKED) {
    if (!(f in after)) continue;
    const a = norm(before[f]), b = norm(after[f]);
    if (a !== b) out.push({ field: f, from: a, to: b });
  }
  return out;
}

/** Statuses that count as "currently a member" for attendance. */
export const statusActive = (s: string) => s === "active" || s === "visitor";

/** Shape one member record for a viewer. `m` is a plain object with ids as strings and names resolved by the caller. */
export function shapeMember(m: any, role: string, opts: { self?: boolean } = {}) {
  const minor = isMinor(m.dob);
  const full = opts.self || !minor || canSeeMinor(role);
  const base = {
    id: m.id, memberId: m.memberId, name: m.name, parish: m.parish, area: m.area, zone: m.zone, parishId: m.parishId,
    category: m.category, status: m.status, joinedAt: m.joinedAt, minor, departments: m.departments ?? [], leadership: m.leadership?.title ? m.leadership : null,
    guardianVerified: minor ? !!m.guardian?.verifiedAt : null,
  };
  if (!full) return { ...base, restricted: true, ageBand: "Under 18" };
  return { ...base, restricted: false, phone: m.phone, email: m.email, dob: m.dob, age: ageOn(m.dob), gender: m.gender, guardian: minor ? m.guardian ?? null : null, dobMissing: !m.dob };
}
