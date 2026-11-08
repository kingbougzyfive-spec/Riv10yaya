import mongoose from "mongoose";
import { handle, audit } from "@/lib/api";
import { ApiError, requireApiUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { PERMS } from "@/lib/rbac";
import { registrantRecipients } from "@/lib/audience";
import { dispatch } from "@/lib/notifier";
import { clean, eventSchema } from "@/lib/event-schemas";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handle<Ctx>(async (req, ctx) => {
  const user = await requireApiUser(PERMS.events);
  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) throw new ApiError(404, "Not found");
  const body = await req.json();
  const { Event } = await getDb();
  const ev = await Event.findById(id);
  if (!ev) throw new ApiError(404, "Event not found.");
  const wasCancelled = ev.status === "cancelled";
  // Quick status changes (publish / unpublish / cancel / close registration) don't need the full form.
  if (body.quick) {
    if (body.status) ev.status = ["draft", "published", "cancelled"].includes(body.status) ? body.status : ev.status;
    if (typeof body.registrationOpen === "boolean") ev.registrationOpen = body.registrationOpen;
  } else {
    const { recurrence, ...i } = eventSchema.parse(body);
    const c = clean({ ...i, recurrence } as any) as any;
    if (c.endsAt && c.endsAt < c.startsAt) throw new ApiError(400, "The end time is before the start time.");
    delete c.recurrence;
    ev.set(c);
  }
  await ev.save();
  await audit(user, "event.update", ev.title, { status: ev.status }, req);
  // Cancelling tells everyone who registered (once).
  if (ev.status === "cancelled" && !wasCancelled) {
    const { Registration } = await getDb();
    const r = await registrantRecipients({ event: ev._id, status: "registered", cancelNotifiedAt: { $exists: false } });
    await dispatch({ event: "event_cancelled", title: `Cancelled: ${ev.title}`, body: "We're sorry. This event will no longer hold as planned. Please check announcements for updates.", link: "/events", userIds: r.userIds, noEmail: r.noEmail, external: r.external, origin: "system" });
    await Registration.updateMany({ event: ev._id, status: "registered" }, { $set: { cancelNotifiedAt: new Date() } });
  }
  return { ok: true };
});

export const DELETE = handle<Ctx>(async (req, ctx) => {
  const user = await requireApiUser(PERMS.events);
  const { id } = await ctx.params;
  const { Event, Registration } = await getDb();
  if (await Registration.exists({ event: id })) throw new ApiError(409, "This event has registrations. Cancel it instead of deleting.");
  await Event.findByIdAndDelete(id);
  await audit(user, "event.delete", id, undefined, req);
  return { ok: true };
});
