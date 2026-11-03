import { handle, audit } from "@/lib/api";
import { ApiError, requireApiUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { newToken } from "@/lib/ids";
import { PERMS } from "@/lib/rbac";
import { clean, eventSchema } from "@/lib/event-schemas";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  await requireApiUser(PERMS.attendanceView);
  const { Event, Registration } = await getDb();
  const events = await Event.find().sort({ startsAt: -1 }).limit(300).lean<any[]>();
  const counts = await Registration.aggregate([{ $match: { status: "registered" } }, { $group: { _id: "$event", n: { $sum: 1 }, attended: { $sum: { $cond: [{ $ifNull: ["$checkedInAt", false] }, 1, 0] } } } }]);
  const c = new Map<string, any>(counts.map((x: any) => [String(x._id), x]));
  return { events: events.map((e) => ({ ...e, id: String(e._id), _id: undefined, flyerId: e.flyerId ? String(e.flyerId) : "", registered: c.get(String(e._id))?.n ?? 0, attended: c.get(String(e._id))?.attended ?? 0 })) };
});

export const POST = handle(async (req) => {
  const user = await requireApiUser(PERMS.events);
  const i = eventSchema.parse(await req.json());
  const base = clean(i);
  if (base.endsAt && base.endsAt < base.startsAt) throw new ApiError(400, "The end time is before the start time.");
  const { Event } = await getDb();
  const rec = i.recurrence && i.recurrence.freq !== "none" ? i.recurrence : null;
  const seriesId = rec ? newToken() : undefined;
  const n = rec ? rec.count : 1;
  const ids: string[] = [];
  for (let k = 0; k < n; k++) {
    const shift = (d?: Date) => { if (!d) return d; const x = new Date(d); if (rec?.freq === "weekly") x.setDate(x.getDate() + 7 * k); if (rec?.freq === "monthly") x.setMonth(x.getMonth() + k); return x; };
    const { recurrence, ...rest } = base as any;
    const doc = await Event.create({ ...rest, startsAt: shift(base.startsAt), endsAt: shift(base.endsAt), registrationDeadline: shift(base.registrationDeadline), seriesId, createdBy: user.id });
    ids.push(String(doc._id));
  }
  await audit(user, "event.create", i.title, { count: n }, req);
  return { ids };
});
