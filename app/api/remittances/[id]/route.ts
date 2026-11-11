import { withTx } from "@/lib/tx";
import { recordDecision } from "@/lib/ledger";
import type { Decision } from "@/lib/ledger-core";
import { z } from "zod";
import mongoose from "mongoose";
import { handle, audit } from "@/lib/api";
import { ApiError, requireApiUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { MONTHS, toKobo } from "@/lib/money";
import { adminsOf, financeTeam, notifyUsers } from "@/lib/notify";
import { PERMS } from "@/lib/rbac";
import { FV_LABEL, PROBLEM_STATUSES, obligationFv, totals } from "@/lib/verification";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  action: z.enum(["begin_review", "confirm", "payment_not_found", "amount_mismatch", "reject", "request_resubmission", "respond", "adjust"]),
  paymentId: z.string().optional(),
  reason: z.string().trim().max(1000).optional().default(""),
  note: z.string().trim().max(1000).optional().default(""), // remarks
  confirmedAmount: z.number().min(0).optional(),
  seenAmount: z.number().min(0).optional(),
  adjustAmount: z.number().optional(),
  bankReference: z.string().trim().max(120).optional().default(""),
  evidenceId: z.string().optional(),
});

const money = (k: number) => `₦${(k / 100).toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;

/**
 * Finance decisions and parish responses. Original submitted values are never edited and nothing is deleted:
 * every step is appended to history with who, when, why, the bank reference matched and the amount seen or confirmed.
 */
export const PATCH = handle<Ctx>(async (req, ctx) => {
  const user = await requireApiUser(PERMS.finance);
  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) throw new ApiError(404, "Not found");
  const i = schema.parse(await req.json());
  const db = await getDb();
  const { Remittance, Media, Parish } = db;
  const r = await Remittance.findById(id);
  if (!r) throw new ApiError(404, "Record not found.");
  const p: any = i.paymentId ? r.payments.id(i.paymentId) : r;
  if (!p) throw new ApiError(404, "Payment not found on this record.");
  const fromStatus: string = p.status;
  const parish = await Parish.findById(r.parish, { name: 1 }).lean<any>();
  const where = `${parish?.name ?? "Parish"} · ${MONTHS[r.month - 1]} ${r.year}${r.kind === "levy" ? ` (${r.description})` : ""}`;
  const entry = (extra: Record<string, unknown>) => ({ at: new Date(), by: user.id, byName: user.name, paymentId: i.paymentId, ...extra });
  const owners = () => adminsOf({ zone: r.zone, area: r.area, parish: r.parish });

  if (i.action === "respond") {
    if (user.role !== "parish_admin" || String(r.parish) !== user.parish) throw new ApiError(403, "You can only respond for your own parish.");
    if (!PROBLEM_STATUSES.includes(p.status)) throw new ApiError(409, "There's nothing to respond to on this record.");
    if (!i.note && !i.evidenceId) throw new ApiError(400, "Add a message or upload new evidence.");
    if (i.evidenceId && !(await Media.exists({ _id: i.evidenceId, private: true, parish: user.parish }))) throw new ApiError(400, "That evidence file isn't yours.");
    p.history.push(entry({ action: "responded", note: i.note, evidenceId: i.evidenceId }));
    p.status = "awaiting_verification"; // the original receipt and every earlier submission stay on record
    await r.save();
    await notifyUsers(await financeTeam(), { title: `Parish responded: ${where}`, body: i.note || "New evidence was uploaded.", link: "/admin/finance", event: "payment_uploaded" });
    await audit(user, "remittance.respond", String(r._id), undefined, req);
    return { ok: true, status: p.status, fv: obligationFv(r.toObject()) };
  }

  // ---- everything below is a finance decision ----
  if (!(PERMS.financeReview as readonly string[]).includes(user.role)) throw new ApiError(403, "Only finance administrators can verify payments.");
  // A parish administrator must never approve their own payment (also guards any user mistakenly scoped to the parish).
  if (user.parish && String(r.parish) === user.parish) throw new ApiError(403, "You can't review your own parish's payment.");
  if (String(p.submittedBy ?? r.submittedBy) === user.id) throw new ApiError(403, "You can't review a payment you submitted.");
  if (i.evidenceId && !(await Media.exists({ _id: i.evidenceId }))) throw new ApiError(400, "That attachment doesn't exist.");

  if (i.action === "adjust") {
    if (r.kind !== "yst") throw new ApiError(400, "Adjustments apply to the Youth Sunday remittance only.");
    if (!i.adjustAmount || !Number.isFinite(i.adjustAmount)) throw new ApiError(400, "Enter the adjustment amount (negative to reduce).");
    if (i.reason.length < 5) throw new ApiError(400, "A reason is required for every manual adjustment.");
    const amountKobo = Math.round(i.adjustAmount * 100);
    r.adjustments.push({ amountKobo, reason: i.reason, by: user.id as any, byName: user.name, at: new Date() });
    r.history.push(entry({ action: "adjusted", reason: i.reason, note: i.note, amountKobo, reference: i.bankReference || undefined, evidenceId: i.evidenceId }));
    await withTx(Remittance.db, async (session) => {
      await recordDecision({ db, user, r, p, paymentKey: "primary", action: "adjust", fromStatus, toStatus: p.status, reason: i.reason, note: i.note, bankReference: i.bankReference, adjustmentKobo: amountKobo, evidenceId: i.evidenceId, session });
      await r.save({ session });
    });
    await audit(user, "remittance.adjust", String(r._id), { amountKobo, reason: i.reason }, req);
    await notifyUsers(await owners(), { title: `Payment record adjusted: ${where}`, body: `${amountKobo > 0 ? "+" : ""}${money(amountKobo)}. Reason: ${i.reason}`, link: "/admin/finance", event: "payment_adjusted" });
    return { ok: true, status: p.status, fv: obligationFv(r.toObject()) };
  }

  if (i.action === "begin_review") {
    if (p.status !== "submitted") throw new ApiError(409, "This payment is already being reviewed or has been decided.");
    p.status = "awaiting_verification";
    p.history.push(entry({ action: "verification_started", note: i.note }));
  } else if (i.action === "confirm") {
    if (p.status === "confirmed") throw new ApiError(409, "This payment is already confirmed.");
    const kobo = i.confirmedAmount !== undefined ? toKobo(i.confirmedAmount) : p.amountKobo;
    if (kobo <= 0) throw new ApiError(400, "Enter the amount you found in the account statement.");
    if (kobo !== p.amountKobo && !i.reason && !i.note) throw new ApiError(400, `The confirmed amount (${money(kobo)}) differs from the declared amount (${money(p.amountKobo)}). Please say why.`);
    p.status = "confirmed";
    p.confirmedKobo = kobo;
    p.history.push(entry({ action: "confirmed", reason: i.reason, note: i.note, amountKobo: kobo, reference: i.bankReference || undefined, evidenceId: i.evidenceId }));
  } else {
    if (p.status === "confirmed") throw new ApiError(409, "This payment is already confirmed. Use a manual adjustment to correct it, with a reason.");
    if (i.reason.length < 3) throw new ApiError(400, "Please give the reason for this decision.");
    p.status = { payment_not_found: "payment_not_found", amount_mismatch: "amount_mismatch", reject: "rejected", request_resubmission: "resubmission_required" }[i.action];
    if (i.action === "amount_mismatch" && i.seenAmount !== undefined) p.seenKobo = toKobo(i.seenAmount);
    p.history.push(entry({ action: i.action, reason: i.reason, note: i.note, amountKobo: i.action === "amount_mismatch" && i.seenAmount !== undefined ? toKobo(i.seenAmount) : undefined, reference: i.bankReference || undefined, evidenceId: i.evidenceId }));
  }
  p.reviewedBy = user.id;
  p.reviewedAt = new Date();
  r.markModified("payments");
  // One transaction: the decision records, the ledger row (confirmations only) and the remittance change succeed together.
  await withTx(Remittance.db, async (session) => {
    await recordDecision({ db, user, r, p, paymentKey: i.paymentId || "primary", action: i.action as Decision, fromStatus, toStatus: p.status, reason: i.reason, note: i.note, bankReference: i.bankReference, seenKobo: p.seenKobo, confirmedKobo: p.status === "confirmed" ? p.confirmedKobo : undefined, evidenceId: i.evidenceId, session });
    await r.save({ session });
  });
  await audit(user, `remittance.${i.action}`, String(r._id), { status: p.status, paymentId: i.paymentId }, req);

  // Notify the parish, its area and its zone. A missing payment is an open verification issue, not a finding of misconduct.
  if (PROBLEM_STATUSES.includes(p.status)) {
    const head = p.status === "payment_not_found" ? "Payment not found: financial verification outstanding" : `${FV_LABEL[p.status as keyof typeof FV_LABEL]}`;
    await notifyUsers(await owners(), {
      title: `${head} (${where})`,
      body: `${i.reason} Please reply with more transaction details or upload additional evidence. Your monthly report is not affected.`,
      link: "/admin/finance",
      event: ({ payment_not_found: "payment_not_found", amount_mismatch: "amount_mismatch", rejected: "evidence_rejected", resubmission_required: "evidence_requested" } as Record<string, string>)[p.status] ?? "payment_not_found",
    });
  } else if (p.status === "confirmed") {
    const t = totals(r.toObject());
    await notifyUsers(await adminsOf({ parish: r.parish }), { title: `Payment confirmed: ${where}`, body: t.satisfied ? "Your remittance is fully confirmed." : `${money(t.outstandingKobo)} is still outstanding.`, link: "/admin/finance", event: "payment_confirmed" });
  }
  return { ok: true, status: p.status, fv: obligationFv(r.toObject()) };
});
