import { z } from "zod";
import { handle, audit } from "@/lib/api";
import { ApiError, requireApiUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { PERMS } from "@/lib/rbac";
import { reportDraftSchema, reportSubmitSchema, saveReportDraft, submitReport } from "@/lib/report-submit";
import { areaRollup, zoneRollup } from "@/lib/rollup";
import { MONTHS } from "@/lib/money";
import { adminsOf, notifyUsers } from "@/lib/notify";
import { reportRef } from "@/lib/ids";
import mongoose from "mongoose";
import { obligationFv, totals } from "@/lib/verification";
import { canSeeContact, recordScope, resolveIdentity } from "@/lib/scope";

export const dynamic = "force-dynamic";

export const GET = handle(async (req) => {
  const user = await requireApiUser(PERMS.reports);
  const scope = await recordScope(user);
  if (scope === null) throw new ApiError(403, "No access.");
  const q = new URL(req.url).searchParams;
  const f: any = { ...scope };
  for (const k of ["month", "year"]) if (q.get(k)) f[k] = Number(q.get(k));
  if (q.get("type")) f.type = q.get("type");
  const st = q.get("status");
  f.status = st && ["submitted", "completed", "revision_requested", "incomplete"].includes(st) ? st : { $ne: "draft" };
  // Narrowing filters can only shrink what the user's scope already allows, never widen it.
  for (const k of ["zone", "area", "parish"]) {
    const v = q.get(k);
    if (!v) continue;
    if (!mongoose.isValidObjectId(v) || (f[k] && String(f[k]) !== v)) return { rows: [] };
    f[k] = v;
  }
  const fin = q.get("finance");
  const { Report, Remittance } = await getDb();
  let rows = await Report.find(f).sort({ year: -1, month: -1, submittedAt: -1 }).limit(500).lean<any[]>();
  const rem = new Map<string, any>((await Remittance.find({ _id: { $in: rows.map((r) => r.remittance).filter(Boolean) } }).lean<any[]>()).map((r) => [String(r._id), r]));
  if (fin) rows = rows.filter((r) => r.remittance && obligationFv(rem.get(String(r.remittance))) === fin);
  return {
    rows: rows.map((r) => {
      // Contact details only for authorised administrators (or the author's own parish). Never public, never members.
      const seeContact = canSeeContact(user, r);
      const m = r.remittance ? rem.get(String(r.remittance)) : null;
      return {
        id: String(r._id), reportId: r.reportId ?? null, type: r.type, month: r.month, year: r.year, names: r.names, submittedAt: r.submittedAt,
        status: r.status ?? "submitted", reviews: (r.reviews ?? []).map((v: any) => ({ at: v.at, byName: v.byName, action: v.action, note: v.note })), revision: r.revision ?? 1, zoneId: String(r.zone), areaId: r.area ? String(r.area) : null, parishId: r.parish ? String(r.parish) : null,
        submittedBy: r.submittedBy ? String(r.submittedBy) : null,
        history: (r.history ?? []).map((h: any) => ({ revision: h.revision, at: h.at, byName: h.byName, note: h.note, contact: seeContact ? h.contact : null, activity: h.activity })),
        contact: seeContact ? r.contact : null, activity: r.activity, rollup: r.rollup,
        remittance: m ? { status: obligationFv(m), requiredKobo: m.requiredKobo, offeringKobo: m.offeringKobo, amountKobo: m.amountKobo, confirmedKobo: totals(m).confirmedKobo, outstandingKobo: totals(m).outstandingKobo } : null,
      };
    }),
  };
});

export const POST = handle(async (req) => {
  const user = await requireApiUser(PERMS.reportSubmit);
  const body = reportSubmitSchema.parse(await req.json());
  const id = await resolveIdentity(user);
  if (!id) throw new ApiError(400, "Your account isn't linked to a zone, area or parish yet.");
  return submitReport({ id: user.id, byName: user.name, audit: user }, id, body, req);
});

/** Save progress without submitting. */
export const PUT = handle(async (req) => {
  const user = await requireApiUser(PERMS.reportSubmit);
  const body = reportDraftSchema.parse(await req.json());
  const id = await resolveIdentity(user);
  if (!id) throw new ApiError(400, "Your account isn't linked to a zone, area or parish yet.");
  return saveReportDraft({ id: user.id, byName: user.name, audit: user }, id, body);
});
