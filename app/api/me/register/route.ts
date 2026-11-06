import { z } from "zod";
import { handle } from "@/lib/api";
import { ApiError, requireApiUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { phoneKey } from "@/lib/ids";
import { isMinor } from "@/lib/members";
import { registerForEvent } from "@/lib/register-event";

export const dynamic = "force-dynamic";

/** A signed-in member registers themselves. Details come from their own record, never from the request. */
export const POST = handle(async (req) => {
  const user = await requireApiUser(["member"]);
  const i = z.object({ eventId: z.string(), answers: z.record(z.string().max(300)).default({}) }).parse(await req.json());
  const { Member } = await getDb();
  const m = await Member.findOne({ phoneKey: phoneKey(user.phone ?? "") });
  if (!m) throw new ApiError(404, "We couldn't find your member record. Please contact your parish administrator.");
  if (m.status === "inactive" || m.status === "transferred") throw new ApiError(403, "Your membership isn't active. Please contact your parish administrator.");
  if (isMinor(m.dob) && !m.guardian?.verifiedAt) throw new ApiError(403, "Your parish administrator needs to confirm your parent or guardian's consent before you can register for events.");
  const r = await registerForEvent({ eventId: i.eventId, name: m.name, phone: m.phone, email: m.email, parish: String(m.parish), answers: i.answers, member: String(m._id) });
  return { reference: r.reference, title: r.title };
});

/** Events a member can register for right now, and which ones they already have. */
export const GET = handle(async () => {
  const user = await requireApiUser(["member"]);
  const { Event, Registration } = await getDb();
  const key = phoneKey(user.phone ?? "");
  const [events, mine] = await Promise.all([
    Event.find({ status: "published", registrationOpen: true, startsAt: { $gte: new Date() } }).sort({ startsAt: 1 }).limit(30).lean<any[]>(),
    Registration.find({ phoneKey: key, status: "registered" }, { event: 1, reference: 1 }).lean<any[]>(),
  ]);
  const have = new Map(mine.map((r) => [String(r.event), r.reference]));
  return { events: events.filter((e) => !e.registrationDeadline || new Date(e.registrationDeadline) >= new Date()).map((e) => ({ id: String(e._id), title: e.title, venue: e.venue, startsAt: e.startsAt, customFields: e.customFields ?? [], reference: have.get(String(e._id)) ?? null })) };
});
