import { z } from "zod";
import mongoose from "mongoose";
import { handle, audit } from "@/lib/api";
import { ApiError, requireApiUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { toKobo } from "@/lib/money";
import { PERMS } from "@/lib/rbac";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  action: z.enum(["confirm", "reject", "request_evidence", "flag", "respond"]),
  note: z.string().trim().max(1000).optional().default(""),
  confirmedAmount: z.number().min(0).optional(),
  evidenceId: z.string().optional(),
});

/** Review (finance) and respond (parish). Original submitted values are never edited; every step is appended to history. */
export const PATCH = handle<Ctx>(async (req, ctx) => {
  const user = await requireApiUser(PERMS.finance);
  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) throw new ApiError(404, "Not found");
  const i = schema.parse(await req.json());
  const { Remittance, Media } = await getDb();
  const r = await Remittance.findById(id);
  if (!r) throw new ApiError(404, "Record not found.");

  if (i.action === "respond") {
    if (user.role !== "parish_admin" || String(r.parish) !== user.parish) throw new ApiError(403, "You can only respond for your own parish.");
    if (!["needs_evidence", "rejected", "flagged"].includes(r.status)) throw new ApiError(409, "There's nothing to respond to on this record.");
    if (!i.note && !i.evidenceId) throw new ApiError(400, "Add a message or upload new evidence.");
    if (i.evidenceId && !(await Media.exists({ _id: i.evidenceId, private: true, parish: user.parish }))) throw new ApiError(400, "That evidence file isn't yours.");
    r.history.push({ at: new Date(), by: user.id, byName: user.name, action: "responded", note: i.note, evidenceId: i.evidenceId });
    r.status = "submitted";
  } else {
    if (!PERMS.financeReview.includes(user.role as any)) throw new ApiError(403, "Only finance administrators can review payments.");
    // A parish administrator must never approve their own payment (also guards any user mistakenly scoped to the parish).
    if (user.parish && String(r.parish) === user.parish) throw new ApiError(403, "You can't review your own parish's payment.");
    if (String(r.submittedBy) === user.id) throw new ApiError(403, "You can't review a payment you submitted.");
    if (i.action !== "confirm" && !i.note) throw new ApiError(400, "Please add a note explaining why.");
    const status = { confirm: "confirmed", reject: "rejected", request_evidence: "needs_evidence", flag: "flagged" }[i.action] as string;
    if (i.action === "confirm") r.confirmedKobo = i.confirmedAmount !== undefined ? toKobo(i.confirmedAmount) : r.amountKobo;
    r.status = status;
    r.reviewedBy = user.id as any;
    r.reviewedAt = new Date();
    r.history.push({ at: new Date(), by: user.id, byName: user.name, action: i.action, note: i.note });
  }
  await r.save();
  await audit(user, `remittance.${i.action}`, String(r._id), { status: r.status }, req);
  return { ok: true, status: r.status };
});
