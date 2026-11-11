import { after } from "next/server";
import { aiConfigured } from "@/lib/ai-receipt";
import { AUTO_ACTOR, runAnalysis } from "@/lib/receipt-analysis";
import { financeTeam, notifyUsers } from "@/lib/notify";
import { z } from "zod";
import mongoose from "mongoose";
import { handle, audit } from "@/lib/api";
import { ApiError, requireApiUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { duplicateChecks, flagsFromDuplicates } from "@/lib/receipt-checks";
import { getFinance } from "@/lib/finance";
import { obligationFv, paymentFv, totals } from "@/lib/verification";
import { remittanceKobo, toKobo } from "@/lib/money";
import { periodSchema } from "@/lib/report-config";
import { PERMS } from "@/lib/rbac";
import { recordScope, resolveIdentity } from "@/lib/scope";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // the automatic AI receipt reading runs after the response is sent
const oid = z.string().refine((v) => mongoose.isValidObjectId(v), "Upload the payment evidence first");
const date = z.string().refine((v) => !Number.isNaN(Date.parse(v)) && Date.parse(v) <= Date.now() + 86_400_000, "Payment date can't be in the future");
const naira = z.number().positive("Enter an amount above zero").max(1_000_000_000);

const submitSchema = periodSchema.extend({
  offering: naira.or(z.literal(0)),
  paidAt: date,
  amountPaid: naira.optional(),
  reference: z.string().trim().max(80).optional().default(""),
  evidenceId: oid,
  remarks: z.string().trim().max(1000).optional().default(""),
  levies: z.array(z.object({ category: z.enum(["levy", "contribution"]).default("levy"), description: z.string().trim().min(2).max(160), amount: naira, paidAt: date, reference: z.string().trim().max(80).optional().default(""), evidenceId: oid.optional() })).max(10).default([]),
});

export const GET = handle(async (req) => {
  const user = await requireApiUser(PERMS.finance);
  const scope = await recordScope(user);
  if (scope === null) throw new ApiError(403, "No access.");
  const q = new URL(req.url).searchParams;
  const f: any = { ...scope };
  if (q.get("month")) f.month = Number(q.get("month"));
  if (q.get("year")) f.year = Number(q.get("year"));
  if (q.get("kind")) f.kind = q.get("kind");
  const { Remittance, Zone, Area, Parish } = await getDb();
  let [rows, zones, areas, parishes] = await Promise.all([
    Remittance.find(f).sort({ createdAt: -1 }).limit(500).lean<any[]>(),
    Zone.find({}, { name: 1 }).lean<any[]>(), Area.find({}, { name: 1 }).lean<any[]>(), Parish.find({}, { name: 1 }).lean<any[]>(),
  ]);
  const hist = (h: any) => ({ at: h.at, byName: h.byName, action: h.action, note: h.note, reason: h.reason, reference: h.reference, amountKobo: h.amountKobo, paymentId: h.paymentId, evidenceId: h.evidenceId ? String(h.evidenceId) : null });
  const want = q.get("status");
  if (want) rows = rows.filter((r) => obligationFv(r) === want);
  const nm = (l: any[]) => new Map(l.map((x) => [String(x._id), x.name]));
  const [z, a, p] = [nm(zones), nm(areas), nm(parishes)];
  return {
    rows: rows.map((r) => {
      const t = totals(r);
      const pay = (x: any) => ({ id: String(x._id), status: x.status, amountKobo: x.amountKobo, confirmedKobo: x.confirmedKobo, seenKobo: x.seenKobo, paidAt: x.paidAt, reference: x.reference, remarks: x.remarks, evidenceId: x.evidenceId ? String(x.evidenceId) : null, analysis: x.analysis ?? null, flags: flagsFromDuplicates(x.checks), fv: paymentFv(x), history: (x.history ?? []).map(hist) });
      return {
        id: String(r._id), kind: r.kind, month: r.month, year: r.year, status: r.status, description: r.description, fv: obligationFv(r),
        offeringKobo: r.offeringKobo, percentBp: r.percentBp, requiredKobo: r.requiredKobo, amountKobo: r.amountKobo, confirmedKobo: r.confirmedKobo, seenKobo: r.seenKobo,
        totals: t, payments: (r.payments ?? []).map(pay), adjustments: (r.adjustments ?? []).map((a: any) => ({ amountKobo: a.amountKobo, reason: a.reason, byName: a.byName, at: a.at })),
        analysis: r.analysis ?? null, flags: flagsFromDuplicates(r.checks),
        paidAt: r.paidAt, reference: r.reference, remarks: r.remarks, evidenceId: r.evidenceId ? String(r.evidenceId) : null,
        zone: z.get(String(r.zone)), area: r.area ? a.get(String(r.area)) : null, parish: p.get(String(r.parish)), parishId: String(r.parish),
        history: (r.history ?? []).map(hist),
      };
    }),
  };
});

/** Step 1 of the parish monthly flow: remittance + optional separate levies. Activity report can follow immediately. */
export const POST = handle(async (req) => {
  const user = await requireApiUser(["parish_admin"]);
  const i = submitSchema.parse(await req.json());
  const id = await resolveIdentity(user);
  if (!id || id.type !== "parish") throw new ApiError(400, "Your account isn't linked to a parish yet. Ask the Super Administrator.");
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
  const base = { zone: id.zone, area: id.area, parish: id.parish, month: i.month, year: i.year, submittedBy: user.id };
  const hist = (note: string) => [{ at: new Date(), by: user.id, byName: user.name, action: "submitted", note }];

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
  await notifyUsers((await financeTeam()).filter((x) => x !== user.id), { title: `Payment evidence uploaded: ${id.names.parish} · ${i.month}/${i.year}`, body: `${i.levies.length ? `Includes ${i.levies.length} levy/contribution item(s). ` : ""}Waiting for verification.`, link: "/admin/finance", event: "payment_uploaded" });
  // AI examines the receipt automatically, after the parish already has its answer. The reading is advisory only:
  // it never changes a status, and the parish does not wait for it or for finance before writing the activity report.
  if (aiConfigured()) after(async () => { try { await runAnalysis(String(yst._id), null, AUTO_ACTOR); } catch (e) { console.error("automatic AI receipt reading failed", (e as Error)?.message); } });
  await audit(user, "remittance.submit", `${id.names.parish} ${i.month}/${i.year}`, { offeringKobo, requiredKobo, percentBp }, req);
  return { id: String(yst._id), requiredKobo, percentBp };
});
