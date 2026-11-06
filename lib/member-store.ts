import { getDb } from "./db";
import { DEFAULT_CATEGORIES, type Category } from "./members";

export async function getCategories(): Promise<Category[]> {
  const { SystemConfig } = await getDb();
  const doc = await SystemConfig.findOne({ key: "memberCategories" }).lean<any>();
  const list: Category[] | undefined = doc?.value?.list;
  return list?.length ? list : DEFAULT_CATEGORIES;
}
export async function saveCategories(list: Category[]) {
  const { SystemConfig } = await getDb();
  await SystemConfig.updateOne({ key: "memberCategories" }, { $set: { value: { list } } }, { upsert: true });
}

/** All phone keys that identify this person over time. */
export const keysOf = (m: any): string[] => [m.phoneKey, ...(m.oldPhoneKeys ?? [])];

/** Event registrations and attendance for one member, matched by id or by any phone they have had. */
export async function historyOf(m: any) {
  const { Registration, Attendance, Event, AttendanceSession } = await getDb();
  const keys = keysOf(m);
  const [regs, att] = await Promise.all([
    Registration.find({ $or: [{ member: m._id }, { phoneKey: { $in: keys } }], status: "registered" }).sort({ createdAt: -1 }).limit(100).lean<any[]>(),
    Attendance.find({ $or: [{ member: m._id }, { phoneKey: { $in: keys } }] }).sort({ at: -1 }).limit(200).lean<any[]>(),
  ]);
  const [events, sessions] = await Promise.all([
    Event.find({ _id: { $in: regs.map((r) => r.event) } }, { title: 1, startsAt: 1, venue: 1 }).lean<any[]>(),
    AttendanceSession.find({ _id: { $in: att.map((a) => a.session) } }, { title: 1, kind: 1, date: 1 }).lean<any[]>(),
  ]);
  const E = new Map<string, any>(events.map((e) => [String(e._id), e])), S = new Map<string, any>(sessions.map((s) => [String(s._id), s]));
  return {
    events: regs.map((r) => ({ id: String(r._id), eventId: String(r.event), reference: r.reference, title: E.get(String(r.event))?.title ?? "Event", startsAt: E.get(String(r.event))?.startsAt, venue: E.get(String(r.event))?.venue, attended: !!r.checkedInAt })),
    attendance: att.map((a) => ({ id: String(a._id), title: S.get(String(a.session))?.title ?? "Session", kind: S.get(String(a.session))?.kind ?? "", at: a.at, method: a.method })),
  };
}

export async function deptNames(ids: any[]) {
  if (!ids?.length) return [] as { id: string; name: string }[];
  const { Department } = await getDb();
  return (await Department.find({ _id: { $in: ids } }, { name: 1 }).lean<any[]>()).map((d) => ({ id: String(d._id), name: d.name }));
}
