import mongoose from "mongoose";
import { handle, audit } from "@/lib/api";
import { ApiError, requireApiUser } from "@/lib/auth";
import { aiConfigured, readReceipt } from "@/lib/ai-receipt";
import { getDb } from "@/lib/db";
import { PERMS } from "@/lib/rbac";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
type Ctx = { params: Promise<{ id: string }> };

export const POST = handle<Ctx>(async (req, ctx) => {
  const user = await requireApiUser(PERMS.financeReview);
  if (!aiConfigured()) throw new ApiError(400, "AI receipt reading isn't set up. Ask the Super Administrator to add ANTHROPIC_API_KEY (Admin → Integrations).");
  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) throw new ApiError(404, "Not found");
  const { Remittance, Media } = await getDb();
  const r = await Remittance.findById(id);
  if (!r) throw new ApiError(404, "Record not found.");
  if (!r.evidenceId) throw new ApiError(400, "This record has no evidence to read.");
  const m = await Media.findById(r.evidenceId).lean<any>();
  if (!m) throw new ApiError(404, "The evidence file is missing.");
  const buf: Buffer = Buffer.isBuffer(m.data) ? m.data : Buffer.from(m.data.buffer);
  let reading;
  try { reading = await readReceipt(buf, m.mime); } catch (e: any) { throw new ApiError(502, e.message || "AI reading failed."); }
  const declaredNaira = r.amountKobo / 100;
  const amountMatches = reading.amountNaira === null ? null : Math.abs(reading.amountNaira - declaredNaira) < 0.01;
  const refMatches = reading.reference && r.reference ? reading.reference.replace(/\W/g, "").toLowerCase().includes(r.reference.replace(/\W/g, "").toLowerCase()) || r.reference.replace(/\W/g, "").toLowerCase().includes(reading.reference.replace(/\W/g, "").toLowerCase()) : null;
  r.analysis = { ...reading, declaredNaira, amountMatches, refMatches, at: new Date(), by: user.name, advisory: true };
  await r.save();
  await audit(user, "remittance.ai_read", String(r._id), { amountMatches }, req);
  return { analysis: r.analysis };
});
