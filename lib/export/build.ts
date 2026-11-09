import mongoose from "mongoose";
import { ApiError, type SessionUser } from "../auth";
import { getSite } from "../cms";
import { getDb } from "../db";
import { listFilter } from "../gov-server";
import { listMembers } from "../member-list";
import { orgNames } from "../names";
import { ROLE_LABELS } from "../roles";
import { CONTACT_ROLES, clampScope as clamp, recordScope } from "../scope";
import { EXPORT_BY_KEY, isExportType, type ExportType } from "./catalog";
import * as D from "./docs";
import type { ReportDoc } from "./doc";

const oid = (v: string | null) => (v && mongoose.isValidObjectId(v) ? v : "");
const lagosYear = () => new Date(Date.now() + 3600_000).getUTCFullYear();
const lagosMonth = () => new Date(Date.now() + 3600_000).getUTCMonth() + 1;

function period(q: URLSearchParams, defMonth: number) {
  const year = Number(q.get("year")) || lagosYear();
  const m = q.get("month"); const month = m === null || m === "" ? defMonth : Number(m);
  if (!(year >= 2020 && year <= 2100) || !(month >= 0 && month <= 12) || !Number.isInteger(month)) throw new ApiError(400, "Choose a valid month and year.");
  return { year, month };
}

export async function buildExport(type: string, user: SessionUser, q: URLSearchParams): Promise<ReportDoc> {
  if (!isExportType(type)) throw new ApiError(404, "Unknown report.");
  const def = EXPORT_BY_KEY[type];
  if (!def.roles.includes(user.role)) throw new ApiError(403, "Your role can't export this report.");
  const db = await getDb(); const n = await orgNames();
  const { site } = await getSite(); const org = `RCCG ${site.brand.name}`.replace(/^RCCG RCCG/i, "RCCG");
  const scope: any = user.role === "event_admin" ? {} : await recordScope(user);
  if (scope === null) throw new ApiError(403, "No access.");
  const name = (m: Map<string, string>, v: any) => (v ? m.get(String(v)) ?? "" : "");
  const scopeLabel = scope.zone ? `Zone: ${name(n.zone, scope.zone)}` : scope.area ? `Area: ${name(n.area, scope.area)}` : scope.parish ? `Parish: ${name(n.parish, scope.parish)}` : "Whole province";
  const used: string[] = []; const f = clamp(scope, q);
  for (const [k, m] of [["zone", n.zone], ["area", n.area], ["parish", n.parish]] as const) if (oid(q.get(k)) && def.filters.includes(k)) used.push(`${k[0].toUpperCase() + k.slice(1)}: ${m.get(q.get(k)!) ?? "?"}`);
  const base = (extra: string[] = []): D.Base => ({ org, preparedBy: `${user.name} (${ROLE_LABELS[user.role as keyof typeof ROLE_LABELS] ?? user.role})`, scope: scopeLabel, filters: [...used, ...extra], now: new Date(), canContact: (CONTACT_ROLES as readonly string[]).includes(user.role) || (user.role === "parish_admin" && type === "parish_monthly") });
  const contactFor = (r: any) => (CONTACT_ROLES as readonly string[]).includes(user.role) || (!!user.parish && String(r.parish) === user.parish);

  // ---------- monthly reports
  if (type === "parish_monthly" || type === "area_monthly" || type === "zone_monthly") {
    const level = type.split("_")[0] as "parish" | "area" | "zone";
    const { year, month } = period(q, lagosMonth() === 1 ? 12 : lagosMonth() - 1);
    const q2: any = { ...clamp(scope, q, level === "zone" ? ["zone"] : level === "area" ? ["zone", "area"] : ["zone", "area", "parish"]), type: level, year, status: { $ne: "draft" } };
    if (month) q2.month = month;
    const st = q.get("status"); if (st && ["submitted", "completed", "revision_requested", "incomplete"].includes(st)) { q2.status = st; used.push(`Status: ${st.replace(/_/g, " ")}`); }
    const reports = await db.Report.find(q2, { history: 0, reviews: 0 }).lean<any[]>();
    const rems = level === "parish" ? await db.Remittance.find({ _id: { $in: reports.map((r) => r.remittance).filter(Boolean) } }, { history: 0, checks: 0, "payments.history": 0, "payments.checks": 0 }).lean<any[]>() : [];
    const b = base();
    return D.monthlyDoc({ ...b, canContact: b.canContact || (level === "parish" && reports.every((r) => contactFor(r))) && reports.length > 0 }, { level, reports, rems, names: n, year, month, contactFor });
  }

  const sel = { year: 0, month: 0 };
  if (type === "provincial") {
    const { year, month } = period(q, lagosMonth() === 1 ? 12 : lagosMonth() - 1);
    const [parishes, zones, areas, rems, reports] = await Promise.all([db.Parish.find({}).lean<any[]>(), db.Zone.find({}).lean<any[]>(), db.Area.find({}).lean<any[]>(), db.Remittance.find({ year }, { history: 0, checks: 0, "payments.history": 0, "payments.checks": 0 }).lean<any[]>(), db.Report.find({ year, ...(month ? { month } : {}) }, { history: 0, reviews: 0 }).lean<any[]>()]);
    return D.provincialDoc(base(), { parishes, zones, areas, rems, reports, names: n, year, month });
  }
  if (type === "reconciliation" || type === "confirmed_payments" || type === "outstanding_payments") {
    const { year, month } = period(q, 0); Object.assign(sel, { year, month });
    const rf: any = { ...clamp(scope, q), year, ...(month ? { month } : {}) };
    const [rems, parishes, zones, areas] = await Promise.all([db.Remittance.find(rf, { history: 0, checks: 0, "payments.history": 0, "payments.checks": 0 }).lean<any[]>(), db.Parish.find(scope.parish ? { _id: scope.parish } : scope.area ? { area: scope.area } : scope.zone ? { zone: scope.zone } : {}).lean<any[]>(), db.Zone.find({}).lean<any[]>(), db.Area.find({}).lean<any[]>()]);
    const input: D.FinIn & { names: typeof n } = { rems, parishes, zones, areas, year, month, zone: rf.zone ? String(rf.zone) : undefined, area: rf.area ? String(rf.area) : undefined, parish: rf.parish ? String(rf.parish) : undefined, kind: q.get("kind") ?? undefined, names: n };
    if (type === "reconciliation") return D.reconciliationDoc(base(), input);
    if (type === "outstanding_payments") return D.outstandingDoc(base(), input);
    const k = q.get("kind"); const extra = k && ["yst", "levy", "contribution"].includes(k) ? [`Type: ${{ yst: "Youth Sunday 40%", levy: "Levy", contribution: "Contribution" }[k]}`] : [];
    const ids = [...new Set(rems.flatMap((r) => [r, ...(r.payments ?? [])].map((p: any) => String(p.reviewedBy ?? ""))).filter(Boolean))];
    const reviewers = new Map<string, string>((ids.length ? await db.User.find({ _id: { $in: ids } }, { name: 1 }).lean<any[]>() : []).map((u) => [String(u._id), u.name]));
    return D.confirmedDoc(base(extra), { ...input, reviewers });
  }

  if (type === "attendance") {
    const from = q.get("from") ? new Date(q.get("from")! + "T00:00:00+01:00") : new Date(Date.now() - 90 * 86400_000);
    const to = q.get("to") ? new Date(q.get("to")! + "T23:59:59+01:00") : new Date();
    if (Number.isNaN(+from) || Number.isNaN(+to) || from > to) throw new ApiError(400, "Choose a valid date range.");
    const sf: any = { date: { $gte: from, $lte: to } };
    const ev = oid(q.get("event")); if (ev) { sf.event = ev; used.push(`Event: ${(await db.Event.findById(ev, { title: 1 }).lean<any>())?.title ?? "?"}`); }
    if (q.get("kind")) { sf.kind = String(q.get("kind")); used.push(`Type: ${q.get("kind")}`); }
    const sessions = await db.AttendanceSession.find(sf, { token: 0, locationCheck: 0 }).sort({ date: 1 }).lean<any[]>();
    const rows = await db.Attendance.aggregate([{ $match: { session: { $in: sessions.map((s) => s._id) }, ...f } }, { $group: { _id: { s: "$session", z: "$zone", a: "$area", p: "$parish" }, n: { $sum: 1 }, visitors: { $sum: { $cond: ["$visitor", 1, 0] } } } }]);
    const counts = new Map<string, { total: number; visitors: number }>(); const by = { zone: new Map<string, number>(), area: new Map<string, number>(), parish: new Map<string, number>() };
    for (const r of rows) { const k = String(r._id.s); const c = counts.get(k) ?? { total: 0, visitors: 0 }; c.total += r.n; c.visitors += r.visitors; counts.set(k, c); for (const [t, v] of [["zone", r._id.z], ["area", r._id.a], ["parish", r._id.p]] as const) if (v) by[t].set(String(v), (by[t].get(String(v)) ?? 0) + r.n); }
    const provincial = !scope.zone && !scope.area && !scope.parish && user.role !== "event_admin" || user.role === "event_admin";
    return D.attendanceDoc(base(), { from, to, sessions, counts, byZone: by.zone, byArea: by.area, byParish: by.parish, names: n, provincial });
  }

  if (type === "event_registrations") {
    const ev = oid(q.get("event")); if (!ev) throw new ApiError(400, "Choose an event.");
    const [event, regs] = await Promise.all([db.Event.findById(ev).lean<any>(), db.Registration.find({ ...f, event: ev, status: "registered" }).sort({ createdAt: -1 }).limit(5000).lean<any[]>()]);
    if (!event) throw new ApiError(404, "Event not found.");
    used.unshift(`Event: ${event.title}`);
    return D.registrationsDoc(base(), { event, regs, names: n });
  }

  if (type === "members") {
    const params = new URLSearchParams(); for (const k of ["zone", "area", "parish", "status", "category", "leaders"]) if (q.get(k)) params.set(k, q.get(k)!);
    for (const k of ["status", "category"]) if (q.get(k)) used.push(`${k[0].toUpperCase() + k.slice(1)}: ${q.get(k)}`);
    if (q.get("leaders") === "1") used.push("Leaders only");
    const r = await listMembers(params, user, scope, 5000);
    return D.membersDoc(base(), r);
  }

  // leadership
  const lq = new URLSearchParams(); for (const k of ["level", "zone", "area", "parish"]) if (q.get(k)) lq.set(k, q.get(k)!);
  if (q.get("level")) used.push(`Level: ${q.get("level")}`);
  const af: any = listFilter(user, lq); const cf: any = listFilter(user, lq);
  const status = q.get("status") === "all" ? "all" : "active"; if (status === "active") { af.status = "active"; cf.status = "active"; } else used.push("Including past appointments");
  const [appointments, committees] = await Promise.all([db.Appointment.find(af).limit(2000).lean<any[]>(), db.Committee.find(cf).limit(1000).lean<any[]>()]);
  const dids = [...new Set(appointments.map((a) => String(a.department ?? "")).filter(Boolean))];
  const depts = new Map<string, string>((dids.length ? await db.Department.find({ _id: { $in: dids } }, { name: 1 }).lean<any[]>() : []).map((d) => [String(d._id), d.name]));
  return D.leadershipDoc(base(), { appointments, committees, depts, names: n, status });
}
export type { ExportType };
