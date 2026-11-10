import { z } from "zod";
import mongoose from "mongoose";
import { handle, audit } from "@/lib/api";
import { ApiError, hashPassword, requireApiUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { ROLES } from "@/lib/models";
import { PERMS } from "@/lib/rbac";
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
  active: z.boolean().optional(),
  password: passwordField.optional(),
});

function needScope(role: string, v: { zone?: string; area?: string; parish?: string }) {
  if (role === "zonal_admin" && !v.zone) throw new ApiError(400, "Choose the zone this administrator manages.");
  if (role === "area_admin" && !v.area) throw new ApiError(400, "Choose the area this administrator manages.");
  if (role === "parish_admin" && !v.parish) throw new ApiError(400, "Choose the parish this administrator manages.");
}
const clean = (v?: string) => (v ? v : undefined);

export const GET = handle(async () => {
  await requireApiUser(PERMS.users);
  const { User, Zone, Area, Parish } = await getDb();
  const users = await User.find({}, { passwordHash: 0 }).sort({ createdAt: -1 }).lean<any[]>();
  const [zones, areas, parishes] = await Promise.all([Zone.find().lean<any[]>(), Area.find().lean<any[]>(), Parish.find({}, { transfers: 0 }).lean<any[]>()]);
  const nm = (list: any[]) => new Map(list.map((x) => [String(x._id), x.name]));
  const z = nm(zones), a = nm(areas), p = nm(parishes);
  return {
    users: users.map((u) => ({
      id: String(u._id), name: u.name, email: u.email, phone: u.phone, role: u.role, active: u.active, lastLoginAt: u.lastLoginAt,
      zone: u.zone ? String(u.zone) : "", area: u.area ? String(u.area) : "", parish: u.parish ? String(u.parish) : "",
      scopeLabel: [u.zone && z.get(String(u.zone)), u.area && a.get(String(u.area)), u.parish && p.get(String(u.parish))].filter(Boolean).join(" → "),
    })),
  };
});

export const POST = handle(async (req) => {
  const actor = await requireApiUser(PERMS.users);
  const i = createSchema.parse(await req.json());
  needScope(i.role, i);
  const { User } = await getDb();
  const u = await User.create({
    name: i.name, email: i.email, phone: i.phone || undefined, role: i.role,
    zone: clean(i.zone), area: clean(i.area), parish: clean(i.parish),
    passwordHash: await hashPassword(i.password),
    mustChangePassword: true, // an admin-chosen password is temporary: the person replaces it at first sign-in
  });
  await audit(actor, "user.create", i.email, { entity: "user", entityId: String(u._id), after: { name: i.name, email: i.email, phone: i.phone || null, role: i.role, zone: clean(i.zone) ?? null, area: clean(i.area) ?? null, parish: clean(i.parish) ?? null, active: true } }, req);
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
  const before = { name: u.name, phone: u.phone ?? null, role: u.role, zone: u.zone ? String(u.zone) : null, area: u.area ? String(u.area) : null, parish: u.parish ? String(u.parish) : null, active: u.active };
  if (i.password) { const pm = passwordProblem(i.password, { email: u.email, name: u.name }); if (pm) throw new ApiError(422, pm); }
  if (i.name) u.name = i.name;
  if (i.phone !== undefined) u.phone = i.phone || undefined;
  if (i.role) u.role = i.role;
  if (i.zone !== undefined) u.zone = clean(i.zone) as any;
  if (i.area !== undefined) u.area = clean(i.area) as any;
  if (i.parish !== undefined) u.parish = clean(i.parish) as any;
  needScope(u.role, { zone: u.zone && String(u.zone), area: u.area && String(u.area), parish: u.parish && String(u.parish) });
  if (i.active !== undefined) u.active = i.active;
  if (i.password) { u.passwordHash = await hashPassword(i.password); u.mustChangePassword = true; u.passwordChangedAt = new Date(); }
  const after = { name: u.name, phone: u.phone ?? null, role: u.role, zone: u.zone ? String(u.zone) : null, area: u.area ? String(u.area) : null, parish: u.parish ? String(u.parish) : null, active: u.active };
  // Anything that changes what a person may do, or who they are, ends their existing sessions.
  if (i.password || before.role !== after.role || before.active !== after.active || before.zone !== after.zone || before.area !== after.area || before.parish !== after.parish) u.sessionVersion = (u.sessionVersion ?? 0) + 1;
  await u.save();
  const diff = (k: keyof typeof before) => before[k] !== after[k];
  const e = { entity: "user", entityId: String(u._id) };
  if (diff("role")) await audit(actor, "user.role_change", u.email, { ...e, before: { role: before.role }, after: { role: after.role } }, req);
  if (diff("active")) await audit(actor, after.active ? "user.reactivate" : "user.deactivate", u.email, { ...e, before: { active: before.active }, after: { active: after.active } }, req);
  if (diff("zone") || diff("area") || diff("parish")) await audit(actor, "user.scope_change", u.email, { ...e, before: { zone: before.zone, area: before.area, parish: before.parish }, after: { zone: after.zone, area: after.area, parish: after.parish } }, req);
  if (diff("name") || diff("phone")) await audit(actor, "user.contact_change", u.email, { ...e, before: { name: before.name, phone: before.phone }, after: { name: after.name, phone: after.phone } }, req);
  if (i.password) await audit(actor, "user.password_reset_by_admin", u.email, { ...e, reason: "Password set by a Super Administrator; the person must replace it at next sign-in" }, req);
  return { ok: true };
});
