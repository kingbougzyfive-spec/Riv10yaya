import { z } from "zod";
import mongoose from "mongoose";
import { handle, audit } from "@/lib/api";
import { ApiError, hashPassword, requireApiUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { ROLES } from "@/lib/models";
import { PERMS } from "@/lib/rbac";
import { assignmentsOf, isScopedRole } from "@/lib/reach";
import { passwordField, passwordProblem } from "@/lib/password";

export const dynamic = "force-dynamic";
const oid = z.string().refine((v) => mongoose.isValidObjectId(v), "Invalid id");
const phone = z.string().trim().regex(/^(\+?\d[\d\s-]{7,16})$/, "Enter a valid phone number").optional().or(z.literal(""));

const base = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().email(),
  phone,
  role: z.enum(ROLES),
  zone: oid.optional().or(z.literal("")),
  area: oid.optional().or(z.literal("")),
  parish: oid.optional().or(z.literal("")),
  /** What they are in charge of. Everything beneath an assigned zone or area is included automatically. */
  zones: z.array(oid).max(60).optional(),
  areas: z.array(oid).max(120).optional(),
  parishes: z.array(oid).max(250).optional(),
});
const createSchema = base.extend({ password: passwordField });
const patchSchema = z.object({
  id: oid,
  name: z.string().trim().min(2).max(80).optional(),
  phone,
  role: z.enum(ROLES).optional(),
  zone: oid.optional().or(z.literal("")),
  area: oid.optional().or(z.literal("")),
  parish: oid.optional().or(z.literal("")),
  zones: z.array(oid).max(60).optional(),
  areas: z.array(oid).max(120).optional(),
  parishes: z.array(oid).max(250).optional(),
  active: z.boolean().optional(),
  password: passwordField.optional(),
});

// Linking an administrator to a zone, area or parish is optional. Until linked they can sign in but see no organisation data (recordScope and resolveIdentity return nothing).
const clean = (v?: string) => (v ? v : undefined);

type Lists = { zones?: string[]; areas?: string[]; parishes?: string[] };
const uniq = (v?: string[]) => [...new Set((v ?? []).filter(Boolean))];

/**
 * Checks the zones, areas and parishes an administrator is put in charge of (they must all exist) and works out the chain of the first one,
 * which is kept on the user for the places that need "the" unit (the parish portal opens on the first parish).
 * Only zonal, area and parish administrators are in charge of anything; for every other role the lists are cleared.
 * Choosing nothing is allowed (they can be linked later).
 */
async function scopeFor(role: string, want: Lists) {
  const empty = { zones: [] as string[], areas: [] as string[], parishes: [] as string[], zone: undefined as string | undefined, area: undefined as string | undefined, parish: undefined as string | undefined };
  if (!isScopedRole(role)) return empty;
  const zones = uniq(want.zones), areas = uniq(want.areas), parishes = uniq(want.parishes);
  const { Zone, Area, Parish } = await getDb();
  const [zd, ad, pd] = await Promise.all([
    zones.length ? Zone.find({ _id: { $in: zones } }, { _id: 1 }).lean<any[]>() : [],
    areas.length ? Area.find({ _id: { $in: areas } }, { zone: 1 }).lean<any[]>() : [],
    parishes.length ? Parish.find({ _id: { $in: parishes } }, { zone: 1, area: 1 }).lean<any[]>() : [],
  ]);
  if (zd.length !== zones.length) throw new ApiError(400, "One of the zones you chose doesn't exist.");
  if (ad.length !== areas.length) throw new ApiError(400, "One of the areas you chose doesn't exist.");
  if (pd.length !== parishes.length) throw new ApiError(400, "One of the parishes you chose doesn't exist.");
  // The first unit that matches the role (else any), with its parents from the database.
  const order = role === "zonal_admin" ? ["zone", "area", "parish"] : role === "area_admin" ? ["area", "zone", "parish"] : ["parish", "area", "zone"];
  let primary = { zone: undefined as string | undefined, area: undefined as string | undefined, parish: undefined as string | undefined };
  for (const k of order) {
    if (k === "zone" && zones[0]) { primary = { zone: zones[0], area: undefined, parish: undefined }; break; }
    if (k === "area" && areas[0]) { primary = { zone: String(ad.find((x) => String(x._id) === areas[0])?.zone), area: areas[0], parish: undefined }; break; }
    if (k === "parish" && parishes[0]) { const p = pd.find((x) => String(x._id) === parishes[0]); primary = { zone: String(p?.zone), area: p?.area ? String(p.area) : undefined, parish: parishes[0] }; break; }
  }
  return { zones, areas, parishes, ...primary };
}

const assignmentsFor = (u: any) => assignmentsOf({ role: u.role, zones: u.role === "zonal_admin" && u.zone ? [String(u.zone)] : [], areas: u.role === "area_admin" && u.area ? [String(u.area)] : [], parishes: u.role === "parish_admin" && u.parish ? [String(u.parish)] : [] });

export const GET = handle(async () => {
  await requireApiUser(PERMS.users);
  const { User, Zone, Area, Parish } = await getDb();
  const users = await User.find({}, { passwordHash: 0 }).sort({ createdAt: -1 }).lean<any[]>();
  const [zones, areas, parishes] = await Promise.all([Zone.find().lean<any[]>(), Area.find().lean<any[]>(), Parish.find({}, { transfers: 0 }).lean<any[]>()]);
  const nm = (list: any[]) => new Map(list.map((x) => [String(x._id), x.name]));
  const z = nm(zones), a = nm(areas), p = nm(parishes);
  return {
    // Older databases can hold records from another system (no name, no email, a role this app doesn't have). Never let one of them break the page.
    users: users.map((u) => {
      const known = (ROLES as readonly string[]).includes(u.role);
      const text = (v: unknown) => (typeof v === "string" ? v : "");
      // Older accounts hold one unit in zone / area / parish; newer ones hold lists.
      const hasLists = [u.zones, u.areas, u.parishes].some((l) => Array.isArray(l) && l.length);
      const mine = hasLists ? { zones: (u.zones ?? []).map(String), areas: (u.areas ?? []).map(String), parishes: (u.parishes ?? []).map(String) } : assignmentsFor(u);
      const total = mine.zones.length + mine.areas.length + mine.parishes.length;
      const names = [...mine.zones.map((x: string) => z.get(x)), ...mine.areas.map((x: string) => a.get(x)), ...mine.parishes.map((x: string) => p.get(x))].filter(Boolean) as string[];
      return {
        id: String(u._id), name: text(u.name).trim() || text(u.email) || "(no name)", email: text(u.email), phone: text(u.phone) || undefined,
        role: known ? u.role : "member", legacy: !known || !text(u.name) || !text(u.email), active: u.active === true, lastLoginAt: u.lastLoginAt,
        zone: u.zone ? String(u.zone) : "", area: u.area ? String(u.area) : "", parish: u.parish ? String(u.parish) : "",
        ...mine,
        unlinked: isScopedRole(u.role) && total === 0,
        scopeLabel: total <= 1
          ? [u.zone && z.get(String(u.zone)), u.area && a.get(String(u.area)), u.parish && p.get(String(u.parish))].filter(Boolean).join(" → ")
          : `In charge of ${total}: ${names.slice(0, 3).join(", ")}${names.length > 3 ? ` +${names.length - 3} more` : ""}`,
      };
    }),
  };
});

export const POST = handle(async (req) => {
  const actor = await requireApiUser(PERMS.users);
  const i = createSchema.parse(await req.json());
  const { User } = await getDb();
  // The older single fields still work: they simply mean a list of one.
  const sc = await scopeFor(i.role, { zones: i.zones ?? (i.zone ? [i.zone] : []), areas: i.areas ?? (i.area ? [i.area] : []), parishes: i.parishes ?? (i.parish ? [i.parish] : []) });
  const u = await User.create({
    name: i.name, email: i.email, phone: i.phone || undefined, role: i.role,
    zone: sc.zone, area: sc.area, parish: sc.parish, zones: sc.zones, areas: sc.areas, parishes: sc.parishes,
    passwordHash: await hashPassword(i.password),
    mustChangePassword: true, // an admin-chosen password is temporary: the person replaces it at first sign-in
  });
  await audit(actor, "user.create", i.email, { entity: "user", entityId: String(u._id), after: { name: i.name, email: i.email, phone: i.phone || null, role: i.role, zones: sc.zones, areas: sc.areas, parishes: sc.parishes, active: true } }, req);
  return { id: String(u._id) };
});

export const PATCH = handle(async (req) => {
  const actor = await requireApiUser(PERMS.users);
  const i = patchSchema.parse(await req.json());
  const { User } = await getDb();
  const u = await User.findById(i.id);
  if (!u) throw new ApiError(404, "User not found.");
  const nextRole = i.role ?? u.role;
  // Never lock the organisation out of its last Super Admin.
  if (u.role === "super_admin" && (nextRole !== "super_admin" || i.active === false)) {
    if ((await User.countDocuments({ role: "super_admin", active: true, _id: { $ne: u._id } })) === 0)
      throw new ApiError(409, "You need at least one active Super Administrator.");
  }
  if (i.id === actor.id && i.active === false) throw new ApiError(409, "You can't deactivate your own account.");
  const ids = (v: unknown) => (Array.isArray(v) ? v.map(String).sort().join(",") : "");
  const before = { name: u.name, phone: u.phone ?? null, role: u.role, zones: ids(u.zones), areas: ids(u.areas), parishes: ids(u.parishes), active: u.active };
  if (i.password) { const pm = passwordProblem(i.password, { email: u.email, name: u.name }); if (pm) throw new ApiError(422, pm); }
  if (i.name) u.name = i.name;
  if (i.phone !== undefined) u.phone = i.phone || undefined;
  if (i.role) u.role = i.role;
  if (i.zones !== undefined || i.areas !== undefined || i.parishes !== undefined || i.zone !== undefined || i.area !== undefined || i.parish !== undefined || i.role) {
    // What is not sent keeps its current value (an account from before several assignments reads its one unit by role).
    const cur = assignmentsOf({ role: nextRole, zones: u.zones?.map(String), areas: u.areas?.map(String), parishes: u.parishes?.map(String) });
    const legacy = !cur.zones.length && !cur.areas.length && !cur.parishes.length ? assignmentsFor(u) : cur;
    const sc = await scopeFor(nextRole, {
      zones: i.zones ?? (i.zone !== undefined ? (i.zone ? [i.zone] : []) : legacy.zones),
      areas: i.areas ?? (i.area !== undefined ? (i.area ? [i.area] : []) : legacy.areas),
      parishes: i.parishes ?? (i.parish !== undefined ? (i.parish ? [i.parish] : []) : legacy.parishes),
    });
    u.zone = sc.zone as any; u.area = sc.area as any; u.parish = sc.parish as any;
    u.zones = sc.zones as any; u.areas = sc.areas as any; u.parishes = sc.parishes as any;
  }
  if (i.active !== undefined) u.active = i.active;
  if (i.password) { u.passwordHash = await hashPassword(i.password); u.mustChangePassword = true; u.passwordChangedAt = new Date(); }
  const after = { name: u.name, phone: u.phone ?? null, role: u.role, zones: ids(u.zones), areas: ids(u.areas), parishes: ids(u.parishes), active: u.active };
  // Anything that changes what a person may do, or who they are, ends their existing sessions.
  if (i.password || before.role !== after.role || before.active !== after.active || before.zones !== after.zones || before.areas !== after.areas || before.parishes !== after.parishes) u.sessionVersion = (u.sessionVersion ?? 0) + 1;
  await u.save();
  const diff = (k: keyof typeof before) => before[k] !== after[k];
  const e = { entity: "user", entityId: String(u._id) };
  if (diff("role")) await audit(actor, "user.role_change", u.email, { ...e, before: { role: before.role }, after: { role: after.role } }, req);
  if (diff("active")) await audit(actor, after.active ? "user.reactivate" : "user.deactivate", u.email, { ...e, before: { active: before.active }, after: { active: after.active } }, req);
  if (diff("zones") || diff("areas") || diff("parishes")) await audit(actor, "user.scope_change", u.email, { ...e, before: { zones: before.zones, areas: before.areas, parishes: before.parishes }, after: { zones: after.zones, areas: after.areas, parishes: after.parishes } }, req);
  if (diff("name") || diff("phone")) await audit(actor, "user.contact_change", u.email, { ...e, before: { name: before.name, phone: before.phone }, after: { name: after.name, phone: after.phone } }, req);
  if (i.password) await audit(actor, "user.password_reset_by_admin", u.email, { ...e, reason: "Password set by a Super Administrator; the person must replace it at next sign-in" }, req);
  return { ok: true };
});
