import { handle } from "@/lib/api";
import { ApiError } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { HOUR, MIN, rateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ ref: string }> };

/** Ticket lookup by reference (unguessable-ish + throttled). Returns only what the ticket needs. */
export const GET = handle<Ctx>(async (req, ctx) => {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  await rateLimit(`tix:${ip}`, 30, MIN, "Too many requests.");
  const { ref } = await ctx.params;
  const { Registration, Event } = await getDb();
  const r = await Registration.findOne({ reference: ref.toUpperCase() }).lean<any>();
  if (!r) throw new ApiError(404, "We couldn't find that registration.");
  const e = await Event.findById(r.event).lean<any>();
  return { reference: r.reference, regId: r.regId, name: r.name, checkedIn: !!r.checkedInAt, event: e ? { id: String(e._id), title: e.title, venue: e.venue, startsAt: e.startsAt, status: e.status } : null };
});
