import { z } from "zod";
import mongoose from "mongoose";
import { handle } from "@/lib/api";
import { ApiError } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { appUrl, newRegId, phoneKey, registrationRef, throttle, validPhone } from "@/lib/ids";
import { sendMail } from "@/lib/mail";
import { sendSms, smsConfigured } from "@/lib/sms";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().refine(validPhone, "Enter a valid phone number"),
  email: z.string().trim().email().optional().or(z.literal("")),
  zone: z.string().optional().or(z.literal("")), area: z.string().optional().or(z.literal("")), parish: z.string().optional().or(z.literal("")),
  answers: z.record(z.string().max(300)).default({}),
});

export const POST = handle<Ctx>(async (req, ctx) => {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!throttle(`reg:${ip}`, 10)) throw new ApiError(429, "Too many attempts. Please wait a minute.");
  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) throw new ApiError(404, "Event not found.");
  const i = schema.parse(await req.json());
  const { Event, Registration, Parish } = await getDb();
  const ev = await Event.findById(id).lean<any>();
  if (!ev || ev.status !== "published") throw new ApiError(404, "This event isn't open for registration.");
  if (!ev.registrationOpen) throw new ApiError(409, "Registration is closed.");
  if (ev.registrationDeadline && new Date(ev.registrationDeadline) < new Date()) throw new ApiError(409, "The registration deadline has passed.");
  if (ev.capacity > 0 && (await Registration.countDocuments({ event: id, status: "registered" })) >= ev.capacity) throw new ApiError(409, "Sorry, this event is full.");

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
  if (await Registration.exists({ event: id, phoneKey: key })) throw new ApiError(409, "This phone number is already registered for the event. Check your confirmation message.");

  const doc = await Registration.create({ event: id, regId: newRegId(), reference: registrationRef(), name: i.name, phone: i.phone, phoneKey: key, email: i.email || undefined, ...org, answers: i.answers });
  if (i.email) {
    await sendMail({ to: i.email, subject: `You're registered: ${ev.title}`, html: `<p>Hello ${i.name},</p><p>You're registered for <b>${ev.title}</b>.</p><p>Your reference: <b>${doc.reference}</b></p><p>Show your QR ticket at the entrance.</p>` }).catch(() => {});
  }
  if (smsConfigured()) {
    await sendSms(i.phone, `You are registered for ${ev.title}. Ref: ${doc.reference}. Your ticket: ${appUrl()}/events/${id}/ticket/${doc.reference}`).catch(() => {});
  }
  return { reference: doc.reference, regId: doc.regId };
});
