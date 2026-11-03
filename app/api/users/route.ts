import { z } from "zod";
import mongoose from "mongoose";
import { handle, audit } from "@/lib/api";
import { ApiError, hashPassword, requireApiUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { ROLES } from "@/lib/models";
import { PERMS } from "@/lib/rbac";

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
const createSchema = base.extend({ password: z.string().min(10, "Use at least 10 characters").max(100) });
const patchSchema = z.object({
  id: oid,
  name: z.string().trim().min(2).max(80).optional(),
  phone,
  role: z.enum(ROLES).optional(),
  zone: oid.optional().or(z.literal("")),
  area: oid.optional().or(z.literal("")),
  parish: oid.optional().or(z.literal("")),
  active: z.boolean().optional(),
  password: z.string().min(10).max(100).optional(),
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
  });
  await audit(actor, "user.create", i.email, { role: i.role }, req);
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
  if (i.name) u.name = i.name;
  if (i.phone !== undefined) u.phone = i.phone || undefined;
  if (i.role) u.role = i.role;
  if (i.zone !== undefined) u.zone = clean(i.zone) as any;
  if (i.area !== undefined) u.area = clean(i.area) as any;
  if (i.parish !== undefined) u.parish = clean(i.parish) as any;
  needScope(u.role, { zone: u.zone && String(u.zone), area: u.area && String(u.area), parish: u.parish && String(u.parish) });
  if (i.active !== undefined) u.active = i.active;
  if (i.password) u.passwordHash = await hashPassword(i.password);
  await u.save();
  await audit(actor, "user.update", u.email, { role: u.role, active: u.active, passwordReset: !!i.password }, req);
  return { ok: true };
});
