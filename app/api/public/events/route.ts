import { handle } from "@/lib/api";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const { Event } = await getDb();
  const since = new Date(Date.now() - 30 * 86400_000);
  const events = await Event.find({ status: { $in: ["published", "cancelled"] }, startsAt: { $gte: since } }).sort({ startsAt: 1 }).limit(100).lean<any[]>();
  return { events: events.map((e) => ({ id: String(e._id), slug: e.slug ?? null, title: e.title, venue: e.venue, startsAt: e.startsAt, endsAt: e.endsAt, status: e.status, flyerId: e.flyerId ? String(e.flyerId) : "", registrationOpen: e.registrationOpen })) };
});
