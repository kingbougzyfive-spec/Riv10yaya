import { z } from "zod";
import mongoose from "mongoose";
import { handle, audit } from "@/lib/api";
import { ApiError, requireApiUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { memberId, phoneKey, validPhone } from "@/lib/ids";
import { orgNames } from "@/lib/names";
import { PERMS } from "@/lib/rbac";
import { recordScope } from "@/lib/scope";

export const dynamic = "force-dynamic";

export const GET = handle(async (req) => {
  const user = await requireApiUser(PERMS.members);
  const scope = await recordScope(user);
  if (scope === null) throw new ApiError(403, "No access.");
  const s = new URL(req.url).searchParams.get("q")?.trim();
  const f: any = { ...scope };
  if (s) { const rx = new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"); f.$or = [{ name: rx }, { phone: rx }, { memberId: rx }]; }
  const { Member } = await getDb();
  const [rows, n] = await Promise.all([Member.find(f).sort({ createdAt: -1 }).limit(500).lean<any[]>(), orgNames()]);
  return { rows: rows.map((m) => ({ id: String(m._id), memberId: m.memberId, name: m.name, phone: m.phone, email: m.email, active: m.active, parish: n.parish.get(String(m.parish)), area: m.area ? n.area.get(String(m.area)) : "", zone: n.zone.get(String(m.zone)) })) };
});

const schema = z.object({ name: z.string().trim().min(2).max(100), phone: z.string().trim().refine(validPhone, "Enter a valid phone number"), email: z.string().email().optional().or(z.literal("")), parish: z.string().optional() });

export const POST = handle(async (req) => {
  const user = await requireApiUser(PERMS.members);
  const i = schema.parse(await req.json());
  const parishId = user.role === "parish_admin" ? user.parish : i.parish;
  if (!parishId || !mongoose.isValidObjectId(parishId)) throw new ApiError(400, "Choose the member's parish.");
  const { Member, Parish } = await getDb();
  const p = await Parish.findById(parishId, { zone: 1, area: 1 }).lean<any>();
  if (!p) throw new ApiError(400, "That parish doesn't exist.");
  const okScope = ["super_admin", "provincial_admin"].includes(user.role) || (user.role === "zonal_admin" && String(p.zone) === user.zone) || (user.role === "area_admin" && String(p.area) === user.area) || (user.role === "parish_admin" && String(p._id) === user.parish);
  if (!okScope) throw new ApiError(403, "That parish is outside your responsibility.");
  const key = phoneKey(i.phone);
  if (await Member.exists({ phoneKey: key })) throw new ApiError(409, "A member with this phone number already exists.");
  const m = await Member.create({ memberId: memberId(), name: i.name, phone: i.phone, phoneKey: key, email: i.email || undefined, zone: p.zone, area: p.area ?? null, parish: p._id });
  await audit(user, "member.create", m.memberId, undefined, req);
  return { id: String(m._id), memberId: m.memberId };
});

export const PATCH = handle(async (req) => {
  const user = await requireApiUser(PERMS.members);
  const i = z.object({ id: z.string(), active: z.boolean() }).parse(await req.json());
  const scope = await recordScope(user);
  if (scope === null) throw new ApiError(403, "No access.");
  const { Member } = await getDb();
  const m = await Member.findOne({ _id: i.id, ...scope });
  if (!m) throw new ApiError(404, "Member not found in your scope.");
  m.active = i.active; await m.save();
  await audit(user, "member.update", m.memberId, { active: i.active }, req);
  return { ok: true };
});
