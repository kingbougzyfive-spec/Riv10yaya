import mongoose from "mongoose";
import { handle } from "@/lib/api";
import { ApiError } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export const GET = handle<Ctx>(async (_req, ctx) => {
  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) throw new ApiError(404, "Event not found.");
  const { Event, Registration } = await getDb();
  const e = await Event.findById(id).lean<any>();
  if (!e || e.status === "draft") throw new ApiError(404, "Event not found.");
  const registered = await Registration.countDocuments({ event: id, status: "registered" });
  const full = e.capacity > 0 && registered >= e.capacity;
  const closed = !e.registrationOpen || e.status === "cancelled" || full || (e.registrationDeadline && new Date(e.registrationDeadline) < new Date()) || new Date(e.endsAt || e.startsAt) < new Date();
  return {
    event: {
      id: String(e._id), title: e.title, description: e.description, venue: e.venue, mapUrl: e.mapUrl, startsAt: e.startsAt, endsAt: e.endsAt, registrationDeadline: e.registrationDeadline,
      eligibility: e.eligibility, organizers: e.organizers, contactName: e.contactName, contactPhone: e.contactPhone, contactEmail: e.contactEmail,
      flyerId: e.flyerId ? String(e.flyerId) : "", status: e.status, customFields: e.customFields ?? [],
      spotsLeft: e.capacity > 0 ? Math.max(0, e.capacity - registered) : null, registrationClosed: !!closed, closedReason: e.status === "cancelled" ? "This event has been cancelled." : full ? "This event is full." : closed ? "Registration is closed." : null,
    },
  };
});
