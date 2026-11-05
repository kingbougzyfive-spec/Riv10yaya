import { z } from "zod";
import mongoose from "mongoose";
import { handle, audit } from "@/lib/api";
import { ApiError, requireApiUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { PERMS } from "@/lib/rbac";
import { activitySchema, contactSchema, FIELDS } from "@/lib/report-config";
import { areaRollup, zoneRollup } from "@/lib/rollup";
import { resolveIdentity } from "@/lib/scope";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

const reviseSchema = z.object({ contact: contactSchema, activity: z.record(z.unknown()), note: z.string().trim().max(300).optional().default("") });

/**
 * Revise a submitted report. Only the administrator responsible for that same parish, area or zone may do it.
 * The previous version (answers and contact snapshot) is appended to the report's history and never overwritten.
 * The financial side (remittance, evidence) is untouched: it has its own reviewed history.
 */
export const PATCH = handle<Ctx>(async (req, ctx) => {
  const user = await requireApiUser(PERMS.reportSubmit);
  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) throw new ApiError(404, "Report not found.");
  const body = reviseSchema.parse(await req.json());
  const { Report } = await getDb();
  const r = await Report.findById(id);
  if (!r) throw new ApiError(404, "Report not found.");
  const me = await resolveIdentity(user);
  const mine = me && me.type === r.type && me.zone === String(r.zone) && (me.area ?? null) === (r.area ? String(r.area) : null) && (me.parish ?? null) === (r.parish ? String(r.parish) : null);
  if (!mine) throw new ApiError(403, "You can only revise your own organisation's report.");
  if (r.status === "draft") throw new ApiError(409, "This report hasn't been submitted yet.");
  if (r.status === "completed") throw new ApiError(409, "This report is marked completed. Ask your reviewer to request a revision if it needs changing.");
  const activity = activitySchema([...FIELDS[r.type as "parish"]]).parse(body.activity);

  r.history.push({ revision: r.revision ?? 1, at: r.updatedAt ?? r.submittedAt, by: r.submittedBy, byName: r.contact?.fullName, contact: r.contact, activity: r.activity, note: body.note });
  r.contact = body.contact;
  r.activity = activity;
  r.revision = (r.revision ?? 1) + 1;
  r.status = "submitted"; // back in the reviewer's queue; revision > 1 shows it was revised
  r.submittedBy = user.id as any;
  if (r.type === "area") r.rollup = await areaRollup(String(r.area), r.month, r.year);
  if (r.type === "zone") r.rollup = await zoneRollup(String(r.zone), r.month, r.year);
  r.markModified("activity"); r.markModified("rollup");
  await r.save();
  await audit(user, `report.revise.${r.type}`, `${r.reportId ?? r._id} v${r.revision}`, { note: body.note }, req);
  return { ok: true, revision: r.revision };
});
