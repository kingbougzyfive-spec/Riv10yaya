import { z } from "zod";
import { handle } from "@/lib/api";
import { ApiError, requireApiUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { phoneKey } from "@/lib/ids";
import { orgNames } from "@/lib/names";

export const dynamic = "force-dynamic";

/** A member's own data only. Everything is keyed to the signed-in user's phone; there is no id parameter, so no one else's record can be requested. */
async function mine() {
  const user = await requireApiUser(["member"]);
  const { Member } = await getDb();
  const m = await Member.findOne({ phoneKey: phoneKey(user.phone ?? "") });
  if (!m) throw new ApiError(404, "We couldn't find your member record. Please contact your parish administrator.");
  return { user, m };
}

export const GET = handle(async () => {
  const { user, m } = await mine();
  const { Attendance, Registration, Event, AttendanceSession } = await getDb();
  const n = await orgNames();
  const [att, regs] = await Promise.all([Attendance.find({ phoneKey: m.phoneKey }).sort({ at: -1 }).limit(100).lean<any[]>(), Registration.find({ phoneKey: m.phoneKey, status: "registered" }).sort({ createdAt: -1 }).limit(50).lean<any[]>()]);
  const [sessions, events] = await Promise.all([AttendanceSession.find({ _id: { $in: att.map((a) => a.session) } }, { title: 1, kind: 1 }).lean<any[]>(), Event.find({ _id: { $in: regs.map((r) => r.event) } }, { title: 1, startsAt: 1, venue: 1, status: 1 }).lean<any[]>()]);
  const sMap = new Map<string, any>(sessions.map((s) => [String(s._id), s])), eMap = new Map<string, any>(events.map((e) => [String(e._id), e]));
  return {
    profile: { memberId: m.memberId, name: m.name, phone: m.phone, email: m.email ?? user.email, zone: n.zone.get(String(m.zone)), area: m.area ? n.area.get(String(m.area)) : "", parish: n.parish.get(String(m.parish)) },
    attendance: att.map((a) => ({ id: String(a._id), title: sMap.get(String(a.session))?.title ?? "Session", at: a.at })),
    events: regs.map((r) => { const e = eMap.get(String(r.event)); return { id: String(r._id), eventId: String(r.event), reference: r.reference, title: e?.title ?? "Event", startsAt: e?.startsAt, venue: e?.venue, status: e?.status, attended: !!r.checkedInAt }; }),
  };
});

const patch = z.object({ name: z.string().trim().min(2).max(100).optional(), email: z.string().trim().email().optional() });

export const PATCH = handle(async (req) => {
  const { user, m } = await mine();
  const i = patch.parse(await req.json());
  const { User } = await getDb();
  if (i.name) { m.name = i.name; await User.updateOne({ _id: user.id }, { $set: { name: i.name } }); }
  if (i.email) { m.email = i.email; await User.updateOne({ _id: user.id }, { $set: { email: i.email.toLowerCase() } }); }
  await m.save();
  return { ok: true };
});
