import mongoose from "mongoose";
import { ApiError } from "./auth";
import { getDb } from "./db";
import { appUrl, newRegId, phoneKey, registrationRef } from "./ids";
import { dispatch } from "./notifier";
import { sendSms, smsConfigured } from "./sms";

export type RegInput = { eventId: string; name: string; phone: string; email?: string; parish?: string; answers: Record<string, string>; member?: string };

/** The one place event registration rules live (public form and signed-in members share it). */
export async function registerForEvent(i: RegInput) {
  if (!mongoose.isValidObjectId(i.eventId)) throw new ApiError(404, "Event not found.");
  const { Event, Registration, Parish } = await getDb();
  const ev = await Event.findById(i.eventId).lean<any>();
  if (!ev || ev.status !== "published") throw new ApiError(404, "This event isn't open for registration.");
  if (!ev.registrationOpen) throw new ApiError(409, "Registration is closed.");
  if (ev.registrationDeadline && new Date(ev.registrationDeadline) < new Date()) throw new ApiError(409, "The registration deadline has passed.");
  if (ev.capacity > 0 && (await Registration.countDocuments({ event: i.eventId, status: "registered" })) >= ev.capacity) throw new ApiError(409, "Sorry, this event is full.");
  for (const f of ev.customFields ?? []) {
    const v = (i.answers[f.key] ?? "").trim();
    if (f.required && !v) throw new ApiError(422, `${f.label} is required.`);
    if (f.type === "select" && v && !f.options.includes(v)) throw new ApiError(422, `${f.label}: choose one of the options.`);
  }
  // Derive the hierarchy from the parish id so names can't drift.
  let org: { zone?: string; area?: string; parish?: string } = {};
  if (i.parish && mongoose.isValidObjectId(i.parish)) {
    const p = await Parish.findById(i.parish, { zone: 1, area: 1 }).lean<any>();
    if (p) org = { zone: String(p.zone), area: p.area ? String(p.area) : undefined, parish: String(p._id) };
  }
  const key = phoneKey(i.phone);
  if (await Registration.exists({ event: i.eventId, phoneKey: key })) throw new ApiError(409, "This phone number is already registered for the event. Check your confirmation message.");
  const doc = await Registration.create({ event: i.eventId, regId: newRegId(), reference: registrationRef(), name: i.name, phone: i.phone, phoneKey: key, email: i.email || undefined, ...org, answers: i.answers, ...(i.member ? { member: i.member } : {}) });
  // Confirmation through the central pipeline: in-app (and email/push by preference) for someone with an account, email otherwise.
  const { User } = await getDb();
  const acct = await User.findOne({ role: "member", phone: key, active: true }, { _id: 1 }).lean<any>();
  const note = { event: "event_registered", title: `You're registered: ${ev.title}`, body: `Your reference is ${doc.reference}. Show your QR ticket at the entrance.`, link: `/events/${i.eventId}/ticket/${doc.reference}` };
  if (acct) await dispatch({ ...note, userIds: [String(acct._id)] });
  else if (i.email) await dispatch({ ...note, external: [{ email: i.email, name: i.name }] });
  if (smsConfigured()) await sendSms(i.phone, `You are registered for ${ev.title}. Ref: ${doc.reference}. Your ticket: ${appUrl()}/events/${i.eventId}/ticket/${doc.reference}`).catch(() => {});
  return { reference: doc.reference, regId: doc.regId, title: ev.title };
}
