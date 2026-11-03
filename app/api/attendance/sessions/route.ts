import { z } from "zod";
import mongoose from "mongoose";
import { handle, audit } from "@/lib/api";
import { ApiError, requireApiUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { newToken } from "@/lib/ids";
import { inScope, orgNames } from "@/lib/names";
import { KINDS } from "@/lib/kinds";
import { PERMS } from "@/lib/rbac";
import { isProvincial } from "@/lib/scope";

export const dynamic = "force-dynamic";
const dt = z.string().refine((v) => !Number.isNaN(Date.parse(v)), "Enter a valid date and time");
const oid = z.string().refine((v) => mongoose.isValidObjectId(v));

const schema = z.object({
  title: z.string().trim().min(3).max(140), description: z.string().max(600).optional().default(""),
  kind: z.enum(KINDS).default("other"), level: z.enum(["parish", "area", "zone", "province"]),
  zone: oid.optional(), area: oid.optional(), parish: oid.optional(), event: oid.optional(),
  date: dt, opensAt: dt, closesAt: dt,
  locationCheck: z.object({ enabled: z.boolean(), lat: z.number().min(-90).max(90).optional(), lng: z.number().min(-180).max(180).optional(), radiusM: z.number().int().min(50).max(5000).default(300) }).optional(),
});

export const GET = handle(async () => {
  const user = await requireApiUser(PERMS.attendanceView);
  const { AttendanceSession, Attendance } = await getDb();
  let f: any = {};
  if (!isProvincial(user) && user.role !== "event_admin") {
    const own = user.role === "zonal_admin" ? { zone: user.zone } : user.role === "area_admin" ? { area: user.area } : { parish: user.parish };
    f = { $or: [own, { level: "province" }] };
    if (user.role === "area_admin") f.$or.push({ level: "parish", area: user.area });
    if (user.role === "zonal_admin") f.$or.push({ level: { $in: ["area", "parish"] }, zone: user.zone });
  }
  const sessions = await AttendanceSession.find(f).sort({ date: -1 }).limit(200).lean<any[]>();
  const counts = await Attendance.aggregate([{ $match: { session: { $in: sessions.map((s) => s._id) } } }, { $group: { _id: "$session", n: { $sum: 1 }, visitors: { $sum: { $cond: ["$visitor", 1, 0] } } } }]);
  const c = new Map<string, any>(counts.map((x: any) => [String(x._id), x]));
  const n = await orgNames();
  const now = Date.now();
  return {
    sessions: sessions.map((s) => ({
      id: String(s._id), title: s.title, kind: s.kind, level: s.level, token: s.token, date: s.date, opensAt: s.opensAt, closesAt: s.closesAt, description: s.description,
      zone: s.zone ? n.zone.get(String(s.zone)) : "", area: s.area ? n.area.get(String(s.area)) : "", parish: s.parish ? n.parish.get(String(s.parish)) : "",
      forceClosed: s.forceClosed, state: s.forceClosed ? "closed" : now < +new Date(s.opensAt) ? "scheduled" : now > +new Date(s.closesAt) ? "closed" : "open",
      count: c.get(String(s._id))?.n ?? 0, visitors: c.get(String(s._id))?.visitors ?? 0, locationCheck: !!s.locationCheck?.enabled,
    })),
  };
});

export const POST = handle(async (req) => {
  const user = await requireApiUser(PERMS.attendance);
  const i = schema.parse(await req.json());
  const { Parish, Area, AttendanceSession } = await getDb();
  let { zone, area, parish } = i as { zone?: string; area?: string; parish?: string };
  // Always derive the full path from the lowest level given, from database ids.
  if (i.level === "parish") {
    if (user.role === "parish_admin") parish = user.parish;
    const p = parish && (await Parish.findById(parish, { zone: 1, area: 1 }).lean<any>());
    if (!p) throw new ApiError(400, "Choose the parish.");
    zone = String(p.zone); area = p.area ? String(p.area) : undefined;
  } else if (i.level === "area") {
    if (user.role === "area_admin") area = user.area;
    const a = area && (await Area.findById(area, { zone: 1 }).lean<any>());
    if (!a) throw new ApiError(400, "Choose the area.");
    zone = String(a.zone); parish = undefined;
  } else if (i.level === "zone") {
    if (user.role === "zonal_admin") zone = user.zone;
    if (!zone) throw new ApiError(400, "Choose the zone.");
    area = parish = undefined;
  } else { zone = area = parish = undefined; if (!["super_admin", "provincial_admin", "event_admin"].includes(user.role)) throw new ApiError(403, "Only provincial staff can create province-wide sessions."); }
  if (i.level !== "province" && !(await inScope(user, { zone, area, parish }))) throw new ApiError(403, "That's outside your responsibility.");
  const opens = new Date(i.opensAt), closes = new Date(i.closesAt);
  if (closes <= opens) throw new ApiError(400, "The closing time must be after the opening time.");
  const lc = i.locationCheck?.enabled && i.locationCheck.lat !== undefined && i.locationCheck.lng !== undefined ? i.locationCheck : { enabled: false };
  const s = await AttendanceSession.create({ title: i.title, description: i.description, kind: i.kind, level: i.level, zone, area, parish, event: i.event, date: new Date(i.date), opensAt: opens, closesAt: closes, token: newToken(), locationCheck: lc, createdBy: user.id });
  await audit(user, "attendance.session.create", i.title, { level: i.level }, req);
  return { id: String(s._id), token: s.token };
});
