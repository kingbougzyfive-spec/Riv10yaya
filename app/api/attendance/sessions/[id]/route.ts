import { z } from "zod";
import mongoose from "mongoose";
import { handle, audit } from "@/lib/api";
import { ApiError, requireApiUser, type SessionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { newToken, phoneKey, validPhone } from "@/lib/ids";
import { inScope, orgNames } from "@/lib/names";
import { PERMS } from "@/lib/rbac";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

async function load(id: string, user: SessionUser, manage: boolean) {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(404, "Session not found.");
  const { AttendanceSession } = await getDb();
  const s = await AttendanceSession.findById(id);
  if (!s) throw new ApiError(404, "Session not found.");
  const mine = s.level === "province" ? !manage || ["super_admin", "provincial_admin", "event_admin"].includes(user.role) : await inScope(user, s);
  if (!mine) throw new ApiError(403, "That session isn't in your scope.");
  return s;
}

export const GET = handle<Ctx>(async (_req, ctx) => {
  const user = await requireApiUser(PERMS.attendanceView);
  const s = await load((await ctx.params).id, user, false);
  const { Attendance } = await getDb();
  const [rows, n] = await Promise.all([Attendance.find({ session: s._id }).sort({ at: -1 }).limit(3000).lean<any[]>(), orgNames()]);
  return {
    session: { id: String(s._id), title: s.title, token: s.token, level: s.level, opensAt: s.opensAt, closesAt: s.closesAt, forceClosed: s.forceClosed, zone: s.zone ? n.zone.get(String(s.zone)) : "", area: s.area ? n.area.get(String(s.area)) : "", parish: s.parish ? n.parish.get(String(s.parish)) : "" },
    records: rows.map((r) => ({ id: String(r._id), name: r.name, phone: r.phoneKey, visitor: r.visitor, at: r.at, method: r.method, parish: r.parish ? n.parish.get(String(r.parish)) : "", area: r.area ? n.area.get(String(r.area)) : "", zone: r.zone ? n.zone.get(String(r.zone)) : "", location: r.location, addedByName: r.addedByName, note: r.note })),
    stats: { total: rows.length, visitors: rows.filter((r) => r.visitor).length, manual: rows.filter((r) => r.method === "manual").length },
  };
});

const patchSchema = z.object({ forceClosed: z.boolean().optional(), reopen: z.boolean().optional(), regenerateToken: z.boolean().optional(), closesAt: z.string().optional() });

export const PATCH = handle<Ctx>(async (req, ctx) => {
  const user = await requireApiUser(PERMS.attendance);
  const s = await load((await ctx.params).id, user, true);
  const i = patchSchema.parse(await req.json());
  if (i.forceClosed !== undefined) s.forceClosed = i.forceClosed;
  if (i.reopen) { s.forceClosed = false; if (new Date(s.closesAt) < new Date()) s.closesAt = new Date(Date.now() + 2 * 3600_000); }
  if (i.closesAt && !Number.isNaN(Date.parse(i.closesAt))) { if (new Date(i.closesAt) <= new Date(s.opensAt)) throw new ApiError(400, "Closing time must be after opening time."); s.closesAt = new Date(i.closesAt); }
  if (i.regenerateToken) s.token = newToken(); // invalidates printed QR codes: use if a code leaks
  await s.save();
  await audit(user, "attendance.session.update", s.title, i, req);
  return { ok: true, token: s.token };
});

const addSchema = z.object({ name: z.string().trim().min(2).max(100), phone: z.string().trim().refine(validPhone, "Enter a valid phone number"), note: z.string().max(200).optional().default("") });

/** Authorised manual correction: add someone who was present. Records who made the change. */
export const POST = handle<Ctx>(async (req, ctx) => {
  const user = await requireApiUser(PERMS.attendance);
  const s = await load((await ctx.params).id, user, true);
  const i = addSchema.parse(await req.json());
  const { Attendance, Member } = await getDb();
  const key = phoneKey(i.phone);
  const m = await Member.findOne({ phoneKey: key, active: true }).lean<any>();
  try {
    await Attendance.create({ session: s._id, member: m?._id, name: m?.name ?? i.name, phoneKey: key, visitor: !m, zone: m?.zone ?? s.zone, area: m ? m.area : s.area, parish: m?.parish ?? s.parish, method: "manual", addedBy: user.id, addedByName: user.name, note: i.note || "Added manually" });
  } catch (e: any) { if (e?.code === 11000) throw new ApiError(409, "This person is already marked present."); throw e; }
  await audit(user, "attendance.manual_add", s.title, { phone: key }, req);
  return { ok: true };
});

export const DELETE = handle<Ctx>(async (req, ctx) => {
  const user = await requireApiUser(PERMS.attendance);
  const s = await load((await ctx.params).id, user, true);
  const rec = new URL(req.url).searchParams.get("record");
  if (!rec) throw new ApiError(400, "Missing record.");
  const { Attendance } = await getDb();
  const r = await Attendance.findOneAndDelete({ _id: rec, session: s._id });
  if (!r) throw new ApiError(404, "Record not found.");
  await audit(user, "attendance.remove", s.title, { name: r.name, phone: r.phoneKey }, req);
  return { ok: true };
});
