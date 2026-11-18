import { z } from "zod";
import { audit } from "./api";
import { ApiError } from "./auth";
import { getDb } from "./db";
import { reportRef } from "./ids";
import { MONTHS } from "./money";
import { adminsOf, notifyUsers } from "./notify";
import { activitySchema, contactSchema, FIELDS, periodSchema } from "./report-config";
import { areaRollup, zoneRollup } from "./rollup";
import type { ParishIdentity, Submitter } from "./remittance-submit";

type Identity = Omit<ParishIdentity, "names"> & { type: "parish" | "area" | "zone"; names: any };

export const reportSubmitSchema = periodSchema.extend({ contact: contactSchema, activity: z.record(z.unknown()) });


export const reportDraftSchema = periodSchema.extend({ contact: z.object({ fullName: z.string().max(120).optional(), phone: z.string().max(30).optional(), altPhone: z.string().max(30).optional() }).default({}), activity: z.record(z.unknown()).default({}) });


/** Submit the monthly activity report. The rules are identical for a signed-in administrator and for someone filling it through a password-protected link. */
export async function submitReport(actor: Submitter, id: Identity, body: z.infer<typeof reportSubmitSchema>, req?: Request) {
  const activity = activitySchema([...FIELDS[id.type]]).parse(body.activity); // blank mandatory fields are rejected, never read as 0

  const { Report, Remittance } = await getDb();
  const key = { type: id.type, zone: id.zone, area: id.area, parish: id.parish, month: body.month, year: body.year };
  const existing = await Report.findOne(key);
  if (existing && existing.status !== "draft") throw new ApiError(409, "This report has already been submitted for that month.");

  let remittance: string | undefined;
  let rollup: unknown;
  if (id.type === "parish") {
    const y = await Remittance.findOne({ parish: id.parish, month: body.month, year: body.year, kind: "yst" }, { _id: 1 }).lean<any>();
    if (!y) throw new ApiError(400, "Please complete the financial section (remittance and evidence) first, then submit the activity report.");
    remittance = String(y._id);
  } else if (id.type === "area") rollup = await areaRollup(id.area!, body.month, body.year);
  else rollup = await zoneRollup(id.zone, body.month, body.year);

  // A saved draft is promoted in place (same report ID); otherwise a new report is created.
  const doc = existing ?? new Report({ ...key, reportId: reportRef(id.type) });
  doc.set({ status: "submitted", revision: 1, names: id.names, contact: body.contact, activity, rollup, remittance, submittedBy: actor.id, submittedAt: new Date() });
  await doc.save();
  await audit(actor.audit, `report.submit.${id.type}`, `${id.names.parish ?? id.names.area ?? id.names.zone} ${body.month}/${body.year}`, undefined, req);
  // Tell the level above (and the provincial office for zone reports); the submitter gets a receipt.
  const who = id.names.parish ?? id.names.area ?? id.names.zone;
  const above = id.type === "parish" ? await adminsOf({ area: id.area, zone: id.zone }) : id.type === "area" ? await adminsOf({ zone: id.zone }) : (await (await getDb()).User.find({ role: "provincial_admin", active: true }, { _id: 1 }).lean<any[]>()).map((u) => String(u._id));
  const when = `${MONTHS[body.month - 1]} ${body.year}`;
  await notifyUsers(above.filter((x) => x !== actor.id), { title: `Report submitted: ${who} · ${when}`, body: `${doc.reportId} is ready for review.`, link: "/admin/reports", event: "report_submitted" });
  await notifyUsers([actor.id], { title: `Your report was submitted · ${when}`, body: `Reference ${doc.reportId}. You'll be told if anything needs revising.`, link: "/admin/reports", event: "report_submitted" });
  return { id: String(doc._id), reportId: doc.reportId };
}

/** Save progress without submitting. Nothing partial is validated or counted as submitted. */
export async function saveReportDraft(actor: Submitter, id: Identity, body: z.infer<typeof reportDraftSchema>) {
  const allowed = new Set(FIELDS[id.type].map((f) => f.key));
  const activity: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body.activity)) if (allowed.has(k) && (typeof v === "string" || typeof v === "number" || v === null)) activity[k] = typeof v === "string" ? v.slice(0, 5000) : v;
  const { Report } = await getDb();
  const key = { type: id.type, zone: id.zone, area: id.area, parish: id.parish, month: body.month, year: body.year };
  const existing = await Report.findOne(key);
  if (existing && existing.status !== "draft") throw new ApiError(409, "This report has already been submitted. Use Revise instead.");
  const doc = existing ?? new Report({ ...key, reportId: reportRef(id.type) });
  doc.set({ status: "draft", names: id.names, contact: body.contact, activity, submittedBy: actor.id });
  doc.markModified("activity");
  await doc.save();
  return { ok: true, savedAt: new Date().toISOString() };
}
