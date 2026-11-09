import { z } from "zod";
import { handle } from "@/lib/api";
import { ApiError, requireApiUser } from "@/lib/auth";
import { makeLoader } from "@/lib/ai-data";
import { aiConfigured } from "@/lib/ai-receipt";
import { TONES, WRITE_KINDS, writeDraft } from "@/lib/ai-write";
import { getDb } from "@/lib/db";
import { PERMS } from "@/lib/rbac";
import { HOURLY_LIMIT } from "@/lib/ai-limits";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const schema = z.object({
  kind: z.enum(Object.keys(WRITE_KINDS) as [keyof typeof WRITE_KINDS, ...(keyof typeof WRITE_KINDS)[]]),
  tone: z.enum(Object.keys(TONES) as [keyof typeof TONES, ...(keyof typeof TONES)[]]).default("warm"),
  brief: z.string().trim().min(5).max(2000), audience: z.string().trim().max(200).optional(), facts: z.string().trim().max(2000).optional(),
  period: z.object({ month: z.number().int().min(1).max(12), year: z.number().int().min(2020).max(2100) }).optional(),
});

/** Drafts text for a person to review and send. It never sends anything and never touches a record. */
export const POST = handle(async (req) => {
  const user = await requireApiUser(PERMS.aiWrite);
  if (!aiConfigured()) throw new ApiError(503, "The AI assistant isn't switched on yet. An administrator needs to add ANTHROPIC_API_KEY.");
  const b = schema.parse(await req.json());
  const { AiLog } = await getDb();
  if ((await AiLog.countDocuments({ user: user.id, createdAt: { $gte: new Date(Date.now() - 3600_000) } })) >= HOURLY_LIMIT) throw new ApiError(429, "You've reached the hourly limit for AI requests. Please try again a little later.");
  let L; if (b.kind === "report_summary") { try { L = await makeLoader(user); } catch { throw new ApiError(403, "Your role can't summarise report data."); } }
  const t0 = Date.now();
  try {
    const d = await writeDraft({ ...b, L });
    await AiLog.create({ user: user.id, userName: user.name, role: user.role, kind: "draft", question: `${b.kind}: ${b.brief}`.slice(0, 1000), answer: d.body.slice(0, 4000), model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5", ms: Date.now() - t0 }).catch(() => {});
    return d;
  } catch (e: any) {
    await AiLog.create({ user: user.id, userName: user.name, role: user.role, kind: "draft", question: `${b.kind}: ${b.brief}`.slice(0, 1000), error: String(e?.message || e).slice(0, 300), ms: Date.now() - t0 }).catch(() => {});
    throw new ApiError(502, e?.message || "The AI service didn't respond. Please try again.");
  }
});
