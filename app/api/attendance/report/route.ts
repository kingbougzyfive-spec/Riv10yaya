import { handle } from "@/lib/api";
import { ApiError, requireApiUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { orgNames } from "@/lib/names";
import { PERMS } from "@/lib/rbac";
import { isProvincial, recordScope } from "@/lib/scope";

export const dynamic = "force-dynamic";

/** Attendance by parish / area / zone / province, per event or reporting period, with a trend. Uses stored attribution, so a later transfer doesn't rewrite history. */
export const GET = handle(async (req) => {
  const user = await requireApiUser(PERMS.attendanceView);
  const scope = user.role === "event_admin" ? {} : await recordScope(user);
  if (scope === null) throw new ApiError(403, "No access.");
  const q = new URL(req.url).searchParams;
  const from = q.get("from") ? new Date(q.get("from")!) : new Date(Date.now() - 90 * 86400_000);
  const to = q.get("to") ? new Date(q.get("to")! + "T23:59:59") : new Date();
  const { AttendanceSession, Attendance } = await getDb();
  const sf: any = { date: { $gte: from, $lte: to } };
  if (q.get("eventId")) sf.event = q.get("eventId");
  if (q.get("kind")) sf.kind = q.get("kind");
  const sessions = await AttendanceSession.find(sf).sort({ date: 1 }).lean<any[]>();
  const af: any = { session: { $in: sessions.map((s) => s._id) }, ...scope };
  const [rows, n] = await Promise.all([Attendance.aggregate([{ $match: af }, { $group: { _id: { s: "$session", z: "$zone", a: "$area", p: "$parish" }, n: { $sum: 1 }, visitors: { $sum: { $cond: ["$visitor", 1, 0] } } } }]), orgNames()]);
  const bySession = new Map<string, number>(), by = { parish: new Map<string, number>(), area: new Map<string, number>(), zone: new Map<string, number>() };
  let total = 0, visitors = 0;
  for (const r of rows) {
    total += r.n; visitors += r.visitors;
    bySession.set(String(r._id.s), (bySession.get(String(r._id.s)) ?? 0) + r.n);
    for (const [k, id] of [["parish", r._id.p], ["area", r._id.a], ["zone", r._id.z]] as const) if (id) by[k].set(String(id), (by[k].get(String(id)) ?? 0) + r.n);
  }
  const top = (m: Map<string, number>, names: Map<string, string>) => [...m].map(([id, count]) => ({ id, name: names.get(id) ?? "?", count })).sort((a, b) => b.count - a.count).slice(0, 25);
  return {
    total, visitors, sessions: sessions.length, province: isProvincial(user) || user.role === "event_admin" ? total : undefined,
    trend: sessions.map((s) => ({ id: String(s._id), title: s.title, date: s.date, level: s.level, count: bySession.get(String(s._id)) ?? 0 })).filter((s) => s.count > 0 || sessions.length < 30),
    byZone: top(by.zone, n.zone), byArea: top(by.area, n.area), byParish: top(by.parish, n.parish),
  };
});
