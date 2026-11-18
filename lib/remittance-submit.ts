import { after } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { audit } from "./api";
import { aiConfigured } from "./ai-receipt";
import { ApiError } from "./auth";
import { getDb } from "./db";
import { getFinance } from "./finance";
import { remittanceKobo, toKobo } from "./money";
import { financeTeam, notifyUsers } from "./notify";
import { duplicateChecks } from "./receipt-checks";
import { AUTO_ACTOR, runAnalysis } from "./receipt-analysis";
import { periodSchema } from "./report-config";

const oid = z.string().refine((v) => mongoose.isValidObjectId(v), "Upload the payment evidence first");
const date = z.string().refine((v) => !Number.isNaN(Date.parse(v)) && Date.parse(v) <= Date.now() + 86_400_000, "Payment date can't be in the future");
const naira = z.number().positive("Enter an amount above zero").max(1_000_000_000);

export const remittanceSubmitSchema = periodSchema.extend({
  offering: naira.or(z.literal(0)),
  paidAt: date,
  amountPaid: naira.optional(),
  reference: z.string().trim().max(80).optional().default(""),
  evidenceId: oid,
  remarks: z.string().trim().max(1000).optional().default(""),
  levies: z.array(z.object({ category: z.enum(["levy", "contribution"]).default("levy"), description: z.string().trim().min(2).max(160), amount: naira, paidAt: date, reference: z.string().trim().max(80).optional().default(""), evidenceId: oid.optional() })).max(10).default([]),
});


export type RemittanceInput = z.infer<typeof remittanceSubmitSchema>;
/** Who is recorded as submitting: a signed-in person, or the administrator who made a fill-in link (with the name of the person who filled it). */
export type Submitter = { id: string; byName: string; audit: Parameters<typeof audit>[0] };
export type ParishIdentity = { zone: string; area: string | null; parish: string | null; names: { parish?: string | null } & Record<string, any> };

/**
 * Step 1 of the parish monthly flow: the Youth Sunday remittance plus any separate levies. The rules are identical whether the parish
 * administrator fills it in themselves or someone else fills it through their password-protected link.
 */
export async function submitRemittance(actor: Submitter, id: ParishIdentity, i: RemittanceInput, req?: Request) {
  const { Remittance, Media } = await getDb();
  if (await Remittance.exists({ parish: id.parish, month: i.month, year: i.year, kind: "yst" }))
    throw new ApiError(409, "Your Youth Sunday remittance for this month was already submitted. You can continue to the activity report.");

  // Evidence must be this parish's own private upload.
  const ids = [i.evidenceId, ...i.levies.map((l) => l.evidenceId).filter(Boolean)] as string[];
  const owned = await Media.countDocuments({ _id: { $in: ids }, private: true, parish: id.parish });
  if (owned !== new Set(ids).size) throw new ApiError(400, "One of the evidence files wasn't uploaded by your parish. Please upload it again.");

  const { percentBp } = await getFinance();
  const offeringKobo = toKobo(i.offering);
  const requiredKobo = remittanceKobo(offeringKobo, percentBp);
  const base = { zone: id.zone, area: id.area, parish: id.parish, month: i.month, year: i.year, submittedBy: actor.id };
  const hist = (note: string) => [{ at: new Date(), by: actor.id, byName: actor.byName, action: "submitted", note }];

  const yst = await Remittance.create({
    ...base, kind: "yst", offeringKobo, percentBp, requiredKobo,
    amountKobo: i.amountPaid !== undefined ? toKobo(i.amountPaid) : requiredKobo,
    paidAt: new Date(i.paidAt), reference: i.reference, evidenceId: i.evidenceId, remarks: i.remarks, history: hist("Remittance submitted"),
  });
  // Repeated-file / repeated-reference checks need no AI key; they just prompt a human look.
  yst.checks = await duplicateChecks(yst).catch(() => null);
  if (yst.checks) await yst.save();
  for (const l of i.levies) {
    const lv = await Remittance.create({ ...base, kind: "levy", category: l.category, description: l.description, amountKobo: toKobo(l.amount), paidAt: new Date(l.paidAt), reference: l.reference, evidenceId: l.evidenceId, history: hist("Levy submitted") });
    lv.checks = await duplicateChecks(lv).catch(() => null);
    if (lv.checks) await lv.save();
  }
  await notifyUsers((await financeTeam()).filter((x) => x !== actor.id), { title: `Payment evidence uploaded: ${id.names.parish} · ${i.month}/${i.year}`, body: `${i.levies.length ? `Includes ${i.levies.length} levy/contribution item(s). ` : ""}Waiting for verification.`, link: "/admin/finance", event: "payment_uploaded" });
  // AI examines the receipt automatically, after the parish already has its answer. The reading is advisory only:
  // it never changes a status, and the parish does not wait for it or for finance before writing the activity report.
  if (aiConfigured()) after(async () => { try { await runAnalysis(String(yst._id), null, AUTO_ACTOR); } catch (e) { console.error("automatic AI receipt reading failed", (e as Error)?.message); } });
  await audit(actor.audit, "remittance.submit", `${id.names.parish} ${i.month}/${i.year}`, { offeringKobo, requiredKobo, percentBp }, req);
  return { id: String(yst._id), requiredKobo, percentBp };
}
