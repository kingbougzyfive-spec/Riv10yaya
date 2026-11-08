import { z } from "zod";
import mongoose from "mongoose";
import { handle, audit } from "@/lib/api";
import { ApiError, requireApiUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { toKobo } from "@/lib/money";
import { financeTeam, notifyUsers } from "@/lib/notify";
import { duplicateChecks } from "@/lib/receipt-checks";
import { totals } from "@/lib/verification";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  amountPaid: z.number().positive().max(1_000_000_000),
  paidAt: z.string().refine((v) => !Number.isNaN(Date.parse(v)), "Enter a valid payment date"),
  reference: z.string().trim().max(80).optional().default(""),
  evidenceId: z.string().refine((v) => mongoose.isValidObjectId(v), "Upload the payment evidence"),
  remarks: z.string().trim().max(500).optional().default(""),
});

/**
 * An additional payment toward the same Youth Sunday obligation (a part payment or top-up).
 * It has its own evidence and its own verification, and only counts once finance confirms it.
 */
export const POST = handle<Ctx>(async (req, ctx) => {
  const user = await requireApiUser(["parish_admin"]);
  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) throw new ApiError(404, "Not found");
  const i = schema.parse(await req.json());
  const { Remittance, Media } = await getDb();
  const r = await Remittance.findById(id);
  if (!r || String(r.parish) !== user.parish) throw new ApiError(404, "Record not found.");
  if (r.kind !== "yst") throw new ApiError(400, "Extra payments are for the Youth Sunday remittance.");
  if (totals(r.toObject()).satisfied) throw new ApiError(409, "This remittance is already fully confirmed. Contact the finance team if you believe an adjustment is needed.");
  if (!(await Media.exists({ _id: i.evidenceId, private: true, parish: user.parish }))) throw new ApiError(400, "That evidence file isn't yours.");
  r.payments.push({ amountKobo: toKobo(i.amountPaid), paidAt: new Date(i.paidAt), reference: i.reference, evidenceId: i.evidenceId, remarks: i.remarks, status: "submitted", submittedBy: user.id, history: [{ at: new Date(), by: user.id, byName: user.name, action: "submitted", note: "Additional payment submitted" }] });
  const pay = r.payments[r.payments.length - 1];
  pay.checks = await duplicateChecks({ _id: pay._id, evidenceId: pay.evidenceId, reference: pay.reference }).catch(() => null);
  await r.save();
  await audit(user, "remittance.add_payment", String(r._id), { amountKobo: pay.amountKobo }, req);
  await notifyUsers(await financeTeam(), { title: "Additional payment submitted", body: `A parish added a payment of ₦${i.amountPaid.toLocaleString("en-NG")} toward its remittance.`, link: "/admin/finance", event: "payment_uploaded" });
  return { ok: true, paymentId: String(pay._id) };
});
