import mongoose from "mongoose";
import { handle } from "@/lib/api";
import { ApiError, requireApiUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { attendanceStats, groupChildren, parishRows, requirements, sumRows, type Level } from "@/lib/overview";
import { PERMS } from "@/lib/rbac";
import { assignmentsOf, inReach } from "@/lib/reach";
import { CONTACT_ROLES, isProvincial, recordScope } from "@/lib/scope";

export const dynamic = "force-dynamic";
/** The units an administrator is in charge of, by name, when there is more than one to choose between. */
async function mineUnits(user: any) {
  const a = assignmentsOf(user);
  if (isProvincial(user) || a.zones.length + a.areas.length + a.parishes.length < 2) return [];
  const { Zone, Area, Parish } = await getDb();
  const [z, ar, p] = await Promise.all([
    a.zones.length ? Zone.find({ _id: { $in: a.zones } }, { name: 1 }).lean<any[]>() : [],
    a.areas.length ? Area.find({ _id: { $in: a.areas } }, { name: 1 }).lean<any[]>() : [],
    a.parishes.length ? Parish.find({ _id: { $in: a.parishes } }, { name: 1 }).lean<any[]>() : [],
  ]);
  const by = (x: any, level: string) => ({ level, id: String(x._id), name: x.name });
  return [...z.map((x) => by(x, "zone")), ...ar.map((x) => by(x, "area")), ...p.map((x) => by(x, "parish"))].sort((x, y) => x.name.localeCompare(y.name, undefined, { numeric: true }));
}
const ok = (v: string | null) => (v && mongoose.isValidObjectId(v) ? v : "");

/**
 * Dashboard for the level being viewed. A user sees their own level by default and may drill DOWN only inside their
 * assigned scope (province → zone → area → parish). Anything outside the scope is refused by the server.
 */
export const GET = handle(async (req) => {
  const user = await requireApiUser(PERMS.reports);
  const scope: any = await recordScope(user);
  if (scope === null) throw new ApiError(403, "No access.");
  const q = new URL(req.url).searchParams;
  const now = new Date();
  const month = Number(q.get("month")) || now.getMonth() + 1, year = Number(q.get("year")) || now.getFullYear();
  const { Zone, Area, Parish, Report, Remittance, Attendance, AttendanceSession, User, Notification } = await getDb();

  // Resolve the target from the most specific id given, then derive its ancestors from the database (never from the client).
  let zoneId = ok(q.get("zone")), areaId = ok(q.get("area")), parishId = ok(q.get("parish"));
  // Default to the first unit they are in charge of; the checks below reject anything outside their reach.
  const mineIds = assignmentsOf(user);
  if (!isProvincial(user) && !zoneId && !areaId && !parishId) {
    if (user.role === "parish_admin" && mineIds.parishes[0]) parishId = mineIds.parishes[0];
    else if (user.role === "area_admin" && mineIds.areas[0]) areaId = mineIds.areas[0];
    else if (mineIds.zones[0]) zoneId = mineIds.zones[0];
    else if (mineIds.areas[0]) areaId = mineIds.areas[0];
    else if (mineIds.parishes[0]) parishId = mineIds.parishes[0];
  }
  let parishDoc: any = null, areaDoc: any = null, zoneDoc: any = null;
  if (parishId) { parishDoc = await Parish.findById(parishId).lean<any>(); if (!parishDoc) throw new ApiError(404, "Parish not found."); areaId = parishDoc.area ? String(parishDoc.area) : ""; zoneId = String(parishDoc.zone); }
  if (areaId) { areaDoc = await Area.findById(areaId).lean<any>(); if (!areaDoc) throw new ApiError(404, "Area not found."); zoneId = String(areaDoc.zone); }
  if (zoneId) { zoneDoc = await Zone.findById(zoneId).lean<any>(); if (!zoneDoc) throw new ApiError(404, "Zone not found."); }
  // Scope check on the DERIVED ancestry, so a crafted id can't escape the user's assignments. (Provincial roles see everything.)
  if (!isProvincial(user) && !inReach(user, { zone: zoneId || undefined, area: areaId || undefined, parish: parishId || undefined })) throw new ApiError(403, "That isn't in your care.");

  const level: Level = parishId ? "parish" : areaId ? "area" : zoneId ? "zone" : "province";
  const loc: any = parishId ? { parish: parishId } : areaId ? { area: areaId } : zoneId ? { zone: zoneId } : {};
  const pLoc: any = parishId ? { _id: parishId } : areaId ? { area: areaId } : zoneId ? { zone: zoneId } : {};
  const from = new Date(year, month - 1, 1), to = new Date(year, month, 1);

  const [parishes, areas, zones, remittances, reports, attendance, sessions] = await Promise.all([
    Parish.find({ ...pLoc, active: true }).sort({ name: 1 }).lean<any[]>(),
    Area.find(zoneId ? { zone: zoneId, ...(areaId ? { _id: areaId } : {}) } : {}).sort({ name: 1 }).lean<any[]>(),
    Zone.find(zoneId ? { _id: zoneId } : {}).sort({ name: 1 }).lean<any[]>(),
    Remittance.find({ ...loc, kind: "yst", month, year }).lean<any[]>(),
    Report.find({ ...loc, month, year, status: { $ne: "draft" } }, { type: 1, parish: 1, area: 1, zone: 1, status: 1, reportId: 1, activity: 1, contact: 1 }).lean<any[]>(),
    Attendance.find({ ...loc, at: { $gte: from, $lt: to } }, { parish: 1, area: 1, zone: 1, phoneKey: 1, visitor: 1, method: 1, session: 1 }).lean<any[]>(),
    AttendanceSession.find({ ...(parishId ? { parish: parishId } : areaId ? { area: areaId } : zoneId ? { zone: zoneId } : {}), date: { $gte: from, $lt: to } }).sort({ date: -1 }).lean<any[]>(),
  ]);
  // Drafts are private to the parish: a draft is "not submitted" everywhere else, but the parish itself should see its own.
  const draft = parishId && user.role === "parish_admin" ? await Report.findOne({ type: "parish", parish: parishId, month, year, status: "draft" }, { _id: 1 }).lean() : null;

  const rows = parishRows({ parishes, areas, zones, remittances, reports, attendance, sessions });
  const sum = sumRows(rows);
  const att = attendanceStats(attendance, sessions);
  const own = (t: string) => reports.find((r) => r.type === t && (t === "zone" ? String(r.zone) === zoneId : String(r.area) === areaId));
  const mine = (r: any) => (r ? { status: r.status, reportId: r.reportId } : { status: "not_started", reportId: null });
  const areaReports = reports.filter((r) => r.type === "area");
  const zoneReports = reports.filter((r) => r.type === "zone");

  const out: any = {
    level, month, year,
    breadcrumb: [{ level: "province", id: "", name: "Province" }, ...(zoneDoc ? [{ level: "zone", id: zoneId, name: zoneDoc.name }] : []), ...(areaDoc ? [{ level: "area", id: areaId, name: areaDoc.name }] : []), ...(parishDoc ? [{ level: "parish", id: parishId, name: parishDoc.name }] : [])],
    // Where this user's own access begins: crumbs above it aren't clickable.
    floor: isProvincial(user) ? "province" : mineIds.zones.length ? "zone" : mineIds.areas.length ? "area" : "parish",
    // Everything this person is in charge of (only when it is more than one unit), so they can switch between them.
    mine: await mineUnits(user),
    totals: sum, attendance: att, hasDraft: !!draft,
    children: groupChildren(level, rows, areas, zones, areaReports),
  };
  if (level === "province") out.provincial = { zones: zones.length, areas: await Area.countDocuments({}), parishes: sum.parishes };
  if (level === "zone") {
    out.zone = { areas: areas.length, parishes: sum.parishes, direct: rows.filter((r) => !r.area).length, areaReportsSubmitted: areaReports.length, areaReportsOutstanding: Math.max(0, areas.length - areaReports.length), zoneReport: mine(own("zone")), activities: sessions.filter((s) => s.level === "zone" || s.level === "province").slice(0, 8).map((s: any) => ({ id: String(s._id), title: s.title, date: s.date, level: s.level })), zoneActivity: zoneReports[0]?.activity ? { programmes: zoneReports[0].activity.zonalProgrammes ?? null, meetings: zoneReports[0].activity.zonalMeetings ?? null } : null };
  }
  if (level === "area") out.area = { parishes: sum.parishes, areaReport: mine(own("area")) };
  if (level === "parish") {
    const row = rows[0];
    const [prev, admins, notes] = await Promise.all([
      Report.find({ type: "parish", parish: parishId, status: { $ne: "draft" } }, { reportId: 1, status: 1, month: 1, year: 1, submittedAt: 1 }).sort({ year: -1, month: -1 }).limit(8).lean<any[]>(),
      User.find({ role: "parish_admin", parish: parishId, active: { $ne: false } }, { name: 1, phone: 1, email: 1 }).lean<any[]>(),
      user.role === "parish_admin" ? Notification.find({ user: user.id }).sort({ createdAt: -1 }).limit(5).lean<any[]>() : Promise.resolve([]),
    ]);
    const canSeeContacts = (CONTACT_ROLES as readonly string[]).includes(user.role) || (user.role === "parish_admin" && inReach(user, { parish: parishId }));
    const snap = reports.find((r) => r.type === "parish")?.contact ?? null;
    out.parish = {
      name: parishDoc.name, address: parishDoc.address ?? null, row,
      remittance: remittances[0] ? { requiredKobo: row.requiredKobo, declaredKobo: row.declaredKobo, confirmedKobo: row.confirmedKobo, outstandingKobo: row.outstandingKobo } : null,
      requirements: requirements({ ...row, reportStatus: draft ? "draft" : row.reportStatus }, remittances[0]),
      previous: prev.map((r) => ({ id: String(r._id), reportId: r.reportId, status: r.status, month: r.month, year: r.year, at: r.submittedAt })),
      notifications: notes.map((n: any) => ({ id: String(n._id), title: n.title, body: n.body, link: n.link, read: !!n.readAt, at: n.createdAt })),
      contacts: canSeeContacts ? { admins: admins.map((a) => ({ name: a.name, phone: a.phone ?? null, email: a.email })), lastReport: snap } : null,
    };
  }
  return out;
});
