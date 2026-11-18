import mongoose from "mongoose";
import { z } from "zod";
import { handle } from "@/lib/api";
import { ApiError, requireApiUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { formOverview, mayFill, recordSchema, saveEventRecord, unitOf } from "@/lib/event-records";
import { PERMS } from "@/lib/rbac";

export const dynamic = "force-dynamic";
const oid = z.string().refine((v) => mongoose.isValidObjectId(v), "Invalid form");

/** One form with the units in the person's care, what each has reported, and the totals. */
export const GET = handle(async (req) => {
  const user = await requireApiUser(PERMS.eventRecords);
  const id = oid.parse(new URL(req.url).searchParams.get("form") ?? "");
  const { EventForm } = await getDb();
  const form: any = await EventForm.findById(id).lean();
  if (!form) throw new ApiError(404, "Form not found.");
  const o = await formOverview(user, form);
  const canFill = ["super_admin", "provincial_admin", "zonal_admin", "area_admin", "parish_admin"].includes(user.role);
  return { form: { id: String(form._id), title: form.title, description: form.description ?? "", eventDate: form.eventDate, endDate: form.endDate ?? null, venue: form.venue ?? "", level: form.level, collectOffering: form.collectOffering !== false, customFields: form.customFields ?? [], status: form.status }, canFill, ...o };
});

/** Fill in or change a unit's record. The total is worked out here from males + females. */
export const POST = handle(async (req) => {
  const user = await requireApiUser(PERMS.fillLinks);
  const body = await req.json();
  const { EventForm } = await getDb();
  const form: any = await EventForm.findById(oid.parse(body.form)).lean();
  if (!form) throw new ApiError(404, "Form not found.");
  const unit = await unitOf(form.level, body.unit);
  if (!mayFill(user, unit)) throw new ApiError(403, "That isn't in your care.");
  const input = recordSchema(form).parse(body);
  return saveEventRecord({ actor: { id: user.id, byName: user.name, audit: user }, form, unit, input, via: "app", req });
});
