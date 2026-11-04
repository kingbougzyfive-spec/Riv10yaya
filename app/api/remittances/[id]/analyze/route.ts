import mongoose from "mongoose";
import { handle, audit } from "@/lib/api";
import { ApiError, requireApiUser } from "@/lib/auth";
import { aiConfigured, readReceipt } from "@/lib/ai-receipt";
import { getDb } from "@/lib/db";
import { getFinance } from "@/lib/finance";
import { duplicateChecks, examine, flagsFromDuplicates } from "@/lib/receipt-checks";
import { PERMS } from "@/lib/rbac";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
type Ctx = { params: Promise<{ id: string }> };

export const POST = handle<Ctx>(async (req, ctx) => {
  const user = await requireApiUser(PERMS.financeReview);
  if (!aiConfigured()) throw new ApiError(400, "AI receipt reading isn't set up. Ask the Super Administrator to add ANTHROPIC_API_KEY (Admin → Integrations).");
  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) throw new ApiError(404, "Not found");
  const { Remittance, Media, Parish } = await getDb();
  const r = await Remittance.findById(id);
  if (!r) throw new ApiError(404, "Record not found.");
  if (!r.evidenceId) throw new ApiError(400, "This record has no evidence to read.");
  const m = await Media.findById(r.evidenceId).lean<any>();
  if (!m) throw new ApiError(404, "The evidence file is missing.");
  const buf: Buffer = Buffer.isBuffer(m.data) ? m.data : Buffer.from(m.data.buffer);
  let reading;
  try { reading = await readReceipt(buf, m.mime); } catch (e: any) { throw new ApiError(502, e.message || "AI reading failed."); }
  const declaredNaira = r.amountKobo / 100;
  const [dups, fin, parish] = await Promise.all([duplicateChecks(r), getFinance(), Parish.findById(r.parish, { name: 1 }).lean<any>()]);
  const flags = [
    ...flagsFromDuplicates(dups),
    ...examine({ reading, declaredNaira, declaredPaidAt: r.paidAt, declaredReference: r.reference, expectedNaira: r.kind === "yst" && r.requiredKobo != null ? r.requiredKobo / 100 : undefined, month: r.month, year: r.year, bank: fin.bank, parishName: parish?.name }),
  ];
  const amountMatches = reading.amountNaira === null ? null : Math.abs(reading.amountNaira - declaredNaira) < 0.01;
  const refMatches = flags.some((f) => f.code === "reference_differs") ? false : reading.reference && r.reference ? true : null;
  r.checks = dups;
  r.analysis = { ...reading, declaredNaira, amountMatches, refMatches, flags, at: new Date(), by: user.name, advisory: true };
  r.markModified("analysis");
  await r.save();
  await audit(user, "remittance.ai_read", String(r._id), { amountMatches, flags: flags.map((f) => f.code) }, req);
  return { analysis: r.analysis };
});
