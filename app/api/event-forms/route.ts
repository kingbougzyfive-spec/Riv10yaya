import mongoose from "mongoose";
import { z } from "zod";
import { audit, handle } from "@/lib/api";
import { ApiError, requireApiUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { formSchema, keyFor } from "@/lib/event-records";
import { PERMS } from "@/lib/rbac";

export const dynamic = "force-dynamic";
const patchSchema = formSchema.partial().extend({ id: z.string().refine((v) => mongoose.isValidObjectId(v)), status: z.enum(["open", "closed"]).optional() });

const view = (f: any, records = 0) => ({
  id: String(f._id), title: f.title, description: f.description ?? "", eventDate: f.eventDate, endDate: f.endDate ?? null, venue: f.venue ?? "", level: f.level,
  collectOffering: f.collectOffering !== false, customFields: f.customFields ?? [], status: f.status, createdByName: f.createdByName ?? "", records,
});

/** Everyone who works with event records can see the forms; only the Super Administrator creates or changes them. */
export const GET = handle(async (req) => {
  await requireApiUser(PERMS.eventRecords);
  const openOnly = new URL(req.url).searchParams.get("open") === "1";
  const { EventForm, EventRecord } = await getDb();
  const forms = await EventForm.find(openOnly ? { status: "open" } : {}).sort({ eventDate: -1 }).limit(200).lean<any[]>();
  const counts = await EventRecord.aggregate([{ $match: { form: { $in: forms.map((f) => f._id) } } }, { $group: { _id: "$form", n: { $sum: 1 } } }]);
  const n = new Map(counts.map((c: any) => [String(c._id), c.n]));
  return { forms: forms.map((f) => view(f, n.get(String(f._id)) ?? 0)) };
});

export const POST = handle(async (req) => {
  const user = await requireApiUser(PERMS.eventForms);
  const i = formSchema.parse(await req.json());
  const { EventForm } = await getDb();
  const f = await EventForm.create({
    title: i.title, description: i.description, eventDate: new Date(i.eventDate), endDate: i.endDate ? new Date(i.endDate) : undefined, venue: i.venue, level: i.level,
    collectOffering: i.collectOffering, customFields: i.customFields.map((c, n) => ({ key: keyFor(n), label: c.label })), createdBy: user.id, createdByName: user.name,
  });
  await audit(user, "eventform.create", i.title, { entity: "eventform", entityId: String(f._id), after: { level: i.level, collectOffering: i.collectOffering, extras: i.customFields.length } }, req);
  return { id: String(f._id) };
});

export const PATCH = handle(async (req) => {
  const user = await requireApiUser(PERMS.eventForms);
  const i = patchSchema.parse(await req.json());
  const { EventForm, EventRecord } = await getDb();
  const f: any = await EventForm.findById(i.id);
  if (!f) throw new ApiError(404, "Form not found.");
  const used = await EventRecord.countDocuments({ form: f._id });
  // Once records exist, what they hold must not change under them: only the words and dates can.
  if (used && ((i.level && i.level !== f.level) || (i.collectOffering !== undefined && i.collectOffering !== (f.collectOffering !== false)) || (i.customFields && i.customFields.length !== f.customFields.length))) {
    throw new ApiError(409, "Records have already been submitted, so the level, the offering and the extra counts can no longer change. Close this form and make a new one if you need different fields.");
  }
  if (i.title !== undefined) f.title = i.title;
  if (i.description !== undefined) f.description = i.description;
  if (i.eventDate !== undefined) f.eventDate = new Date(i.eventDate);
  if (i.endDate !== undefined) f.endDate = i.endDate ? new Date(i.endDate) : undefined;
  if (i.venue !== undefined) f.venue = i.venue;
  if (!used) {
    if (i.level) f.level = i.level;
    if (i.collectOffering !== undefined) f.collectOffering = i.collectOffering;
    if (i.customFields) f.customFields = i.customFields.map((c, n) => ({ key: keyFor(n), label: c.label }));
  } else if (i.customFields) i.customFields.forEach((c, n) => { if (f.customFields[n]) f.customFields[n].label = c.label; });
  if (i.status) { f.status = i.status; f.closedAt = i.status === "closed" ? new Date() : undefined; }
  await f.save();
  await audit(user, i.status ? `eventform.${i.status === "closed" ? "close" : "reopen"}` : "eventform.edit", f.title, { entity: "eventform", entityId: String(f._id) }, req);
  return { ok: true };
});

export const DELETE = handle(async (req) => {
  const user = await requireApiUser(PERMS.eventForms);
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!mongoose.isValidObjectId(id)) throw new ApiError(400, "Invalid form.");
  const { EventForm, EventRecord, FillLink } = await getDb();
  const f: any = await EventForm.findById(id);
  if (!f) throw new ApiError(404, "Form not found.");
  if (await EventRecord.countDocuments({ form: f._id })) throw new ApiError(409, "This form already has records, so it can't be deleted. Close it instead.");
  await FillLink.updateMany({ eventForm: f._id }, { $set: { revokedAt: new Date() } });
  await f.deleteOne();
  await audit(user, "eventform.delete", f.title, { entity: "eventform", entityId: id }, req);
  return { ok: true };
});
