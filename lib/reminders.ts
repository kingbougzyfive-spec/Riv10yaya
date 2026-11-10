/**
 * Scheduled reminders. Runs from /api/cron/reminders (daily). Every reminder carries a key so running it twice
 * never notifies the same person twice. Times are Africa/Lagos (UTC+1).
 */
import { getDb } from "./db";
import { fromMembers } from "./audience";
import { registrantRecipients } from "./audience";
import { dispatch } from "./notifier";
import { MONTHS } from "./money";
import { totals } from "./verification";

export type ReminderConfig = { enabled: boolean; reportDeadlineDay: number; reportLeadDays: number[]; eventHoursAhead: number; meetingHoursAhead: number; outstandingEveryDays: number };
export const DEFAULT_REMINDERS: ReminderConfig = { enabled: true, reportDeadlineDay: 10, reportLeadDays: [3, 1], eventHoursAhead: 36, meetingHoursAhead: 36, outstandingEveryDays: 7 };

export const clampConfig = (c: Partial<ReminderConfig>): ReminderConfig => ({
  enabled: c.enabled !== false,
  reportDeadlineDay: Math.min(28, Math.max(1, Math.round(c.reportDeadlineDay ?? DEFAULT_REMINDERS.reportDeadlineDay))),
  reportLeadDays: [...new Set((c.reportLeadDays ?? DEFAULT_REMINDERS.reportLeadDays).map((n) => Math.round(n)).filter((n) => n >= 1 && n <= 14))].sort((a, b) => b - a).slice(0, 4),
  eventHoursAhead: Math.min(96, Math.max(6, Math.round(c.eventHoursAhead ?? 36))),
  meetingHoursAhead: Math.min(96, Math.max(6, Math.round(c.meetingHoursAhead ?? 36))),
  outstandingEveryDays: Math.min(30, Math.max(2, Math.round(c.outstandingEveryDays ?? 7))),
});
export async function getReminderConfig(): Promise<ReminderConfig> {
  const { SystemConfig } = await getDb();
  const d = await SystemConfig.findOne({ key: "reminders" }).lean<any>();
  return clampConfig({ ...DEFAULT_REMINDERS, ...(d?.value ?? {}) });
}
export async function saveReminderConfig(c: Partial<ReminderConfig>) {
  const v = clampConfig(c);
  await (await getDb()).SystemConfig.updateOne({ key: "reminders" }, { $set: { value: v } }, { upsert: true });
  return v;
}

/** Calendar facts in Lagos time. */
export function lagosDate(now: Date) {
  const l = new Date(now.getTime() + 3_600_000);
  const day = l.getUTCDate(), month = l.getUTCMonth() + 1, year = l.getUTCFullYear();
  const dayIndex = Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
  const prev = month === 1 ? { month: 12, year: year - 1 } : { month: month - 1, year };
  return { day, month, year, dayIndex, iso: l.toISOString().slice(0, 10), period: prev };
}

/** Should a deadline reminder go out today, and with what wording? Pure, so it can be tested. */
export function deadlineStage(daysLeft: number, lead: number[]): { send: boolean; kind: "upcoming" | "today" | "overdue"; key: string } {
  if (daysLeft > 0) return { send: lead.includes(daysLeft), kind: "upcoming", key: `d${daysLeft}` };
  if (daysLeft === 0) return { send: true, kind: "today", key: "d0" };
  const late = -daysLeft;
  return { send: late <= 30 && late % 3 === 0, kind: "overdue", key: `late${late}` };
}

type Summary = Record<string, number | string>;

export async function runReminders(now = new Date()): Promise<{ ran: boolean; summary: Summary }> {
  const cfg = await getReminderConfig();
  if (!cfg.enabled) return { ran: false, summary: { note: "Reminders are switched off." } };
  const L = lagosDate(now);
  const s: Summary = { date: L.iso };
  const { User, Parish, Area, Zone, Report, Remittance, Event, Meeting, Task, Member, Committee } = await getDb();
  const idsOf = async (role: string, field: string, targets: any[]) => targets.length ? (await User.find({ role, active: true, [field]: { $in: targets } }, { _id: 1, [field]: 1 }).lean<any[]>()) : [];

  // ---- 1. Monthly report deadline (the report for last month is due on day N of this month) ----
  const per = L.period;
  const label = `${MONTHS[per.month - 1]} ${per.year}`;
  const stage = deadlineStage(cfg.reportDeadlineDay - L.day, cfg.reportLeadDays);
  s.reportStage = stage.send ? stage.kind : "none";
  let sentReports = 0;
  if (stage.send) {
    const [parishes, areas, zones, reps] = await Promise.all([Parish.find({ active: true }, { _id: 1, name: 1 }).lean<any[]>(), Area.find({}, { _id: 1, name: 1 }).lean<any[]>(), Zone.find({}, { _id: 1, name: 1 }).lean<any[]>(), Report.find({ month: per.month, year: per.year }, { type: 1, parish: 1, area: 1, zone: 1, status: 1 }).lean<any[]>()]);
    const submitted = (t: string, f: string) => new Set(reps.filter((r) => r.type === t && r.status !== "draft").map((r) => String(r[f])));
    const drafts = new Set<string>(reps.filter((r) => r.type === "parish" && r.status === "draft").map((r) => String(r.parish)));
    const subP = submitted("parish", "parish"), subA = submitted("area", "area"), subZ = submitted("zone", "zone");
    const todo: { role: string; field: string; ids: string[]; draft: Set<string> }[] = [
      { role: "parish_admin", field: "parish", ids: parishes.map((p) => String(p._id)).filter((x) => !subP.has(x)), draft: drafts },
      { role: "area_admin", field: "area", ids: areas.map((a) => String(a._id)).filter((x) => !subA.has(x)), draft: new Set<string>() },
      { role: "zonal_admin", field: "zone", ids: zones.map((z) => String(z._id)).filter((x) => !subZ.has(x)), draft: new Set<string>() },
    ];
    const when = stage.kind === "upcoming" ? `due in ${cfg.reportDeadlineDay - L.day} day${cfg.reportDeadlineDay - L.day === 1 ? "" : "s"}` : stage.kind === "today" ? "due today" : `overdue by ${L.day - cfg.reportDeadlineDay} day${L.day - cfg.reportDeadlineDay === 1 ? "" : "s"}`;
    for (const t of todo) {
      const us = await idsOf(t.role, t.field, t.ids);
      const withDraft = us.filter((u) => t.draft.has(String(u[t.field]))).map((u) => String(u._id));
      const without = us.filter((u) => !t.draft.has(String(u[t.field]))).map((u) => String(u._id));
      const base = `rd:${per.year}-${per.month}:${t.role}:${stage.key}`;
      await dispatch({ event: "report_deadline", title: `${label} report ${when}`, body: "Please submit your monthly report and remittance evidence.", link: "/admin/reports", userIds: without, dedupe: base, origin: "system" });
      if (withDraft.length) await dispatch({ event: "report_incomplete", title: `Your ${label} report is still a draft (${when})`, body: "You started it but haven't submitted it yet.", link: "/admin/reports", userIds: withDraft, dedupe: `${base}:draft`, origin: "system" });
      sentReports += us.length;
    }
  }
  s.reportReminders = sentReports;

  // ---- 2. Outstanding remittances (after the deadline, every N days) ----
  let outN = 0;
  if (L.day > cfg.reportDeadlineDay && L.dayIndex % cfg.outstandingEveryDays === 0) {
    const [parishes, rems] = await Promise.all([Parish.find({ active: true }, { _id: 1 }).lean<any[]>(), Remittance.find({ kind: "yst", month: per.month, year: per.year }).lean<any[]>()]);
    const ok = new Set(rems.filter((r) => totals(r).satisfied).map((r) => String(r.parish)));
    const owing = parishes.map((p) => String(p._id)).filter((p) => !ok.has(p));
    const us = await idsOf("parish_admin", "parish", owing);
    await dispatch({ event: "outstanding", title: `Youth Sunday remittance for ${label} is still outstanding`, body: "Please submit or complete your payment and upload the evidence.", link: "/admin/finance", userIds: us.map((u) => String(u._id)), dedupe: `out:${per.year}-${per.month}:${L.dayIndex}`, origin: "system" });
    outN = us.length;
  }
  s.outstandingReminders = outN;

  // ---- 3. Event reminders ----
  let evN = 0;
  const evs = await Event.find({ status: "published", startsAt: { $gt: now, $lte: new Date(now.getTime() + cfg.eventHoursAhead * 3_600_000) } }, { title: 1, startsAt: 1, venue: 1 }).lean<any[]>();
  for (const e of evs) {
    const r = await registrantRecipients({ event: e._id, status: "registered", reminderAt: { $exists: false } });
    if (!r.userIds.length && !r.external.length) continue;
    await dispatch({ event: "event_reminder", title: `Reminder: ${e.title}`, body: `${new Date(e.startsAt).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" })}${e.venue ? ` · ${e.venue}` : ""}. Bring your QR ticket.`, link: "/member", userIds: r.userIds, noEmail: r.noEmail, external: r.external, origin: "system" });
    await (await getDb()).Registration.updateMany({ event: e._id, status: "registered" }, { $set: { reminderAt: now } });
    evN += r.userIds.length + r.external.length;
  }
  s.eventReminders = evN;

  // ---- 4. Meeting reminders (committee members and anyone on the attendance list) ----
  let mtN = 0;
  const mts = await Meeting.find({ status: "scheduled", reminderAt: { $exists: false }, scheduledAt: { $gt: now, $lte: new Date(now.getTime() + cfg.meetingHoursAhead * 3_600_000) } }).lean<any[]>();
  for (const m of mts) {
    let ids = (m.attendance ?? []).map((a: any) => a.member).filter(Boolean);
    if (m.committee) { const c = await Committee.findById(m.committee, { members: 1 }).lean<any>(); ids = [...ids, ...(c?.members ?? []).filter((x: any) => x.active && x.member).map((x: any) => x.member)]; }
    const members = ids.length ? await Member.find({ _id: { $in: ids } }, { phoneKey: 1, oldPhoneKeys: 1, email: 1, name: 1, dob: 1 }).lean<any[]>() : [];
    const r = await fromMembers(members);
    await dispatch({ event: "meeting_reminder", title: `Meeting reminder: ${m.title}`, body: `${new Date(m.scheduledAt).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" })}${m.venue ? ` · ${m.venue}` : ""}`, link: "/member", userIds: r.userIds, noEmail: r.noEmail, origin: "system" });
    await Meeting.updateOne({ _id: m._id }, { $set: { reminderAt: now } });
    mtN += r.userIds.length;
  }
  s.meetingReminders = mtN;

  // ---- 5. Overdue tasks (every third day) ----
  let tkN = 0;
  if (L.dayIndex % 3 === 0) {
    const tasks = await Task.find({ status: { $in: ["open", "in_progress"] }, dueAt: { $lt: now }, assignee: { $exists: true } }).limit(1000).lean<any[]>();
    const members = tasks.length ? await Member.find({ _id: { $in: tasks.map((t) => t.assignee) } }, { phoneKey: 1, oldPhoneKeys: 1, dob: 1 }).lean<any[]>() : [];
    const { User: U } = await getDb();
    const users = members.length ? await U.find({ role: "member", active: true, phone: { $in: members.flatMap((m) => [m.phoneKey, ...(m.oldPhoneKeys ?? [])]) } }, { _id: 1, phone: 1 }).lean<any[]>() : [];
    const byKey = new Map(users.map((u) => [u.phone, String(u._id)]));
    for (const t of tasks) {
      const m = members.find((x) => String(x._id) === String(t.assignee));
      const uid = m && [m.phoneKey, ...(m.oldPhoneKeys ?? [])].map((k: string) => byKey.get(k)).find(Boolean);
      if (!uid) continue;
      await dispatch({ event: "task_overdue", title: `Overdue task: ${t.title}`, body: `This was due ${new Date(t.dueAt).toLocaleDateString("en-NG", { dateStyle: "medium" })}.`, link: "/member", userIds: [uid], dedupe: `to:${t._id}:${Math.floor(L.dayIndex / 3)}`, origin: "system" });
      tkN++;
    }
  }
  s.overdueTaskReminders = tkN;
  return { ran: true, summary: s };
}
