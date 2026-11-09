import { z } from "zod";
import { handle } from "@/lib/api";
import { ApiError, requireApiUser } from "@/lib/auth";
import { accusationNotice, ask } from "@/lib/ai-agent";
import { makeLoader } from "@/lib/ai-data";
import { aiConfigured } from "@/lib/ai-receipt";
import { getDb } from "@/lib/db";
import { HOURLY_LIMIT } from "@/lib/ai-limits";
import { PERMS } from "@/lib/rbac";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const schema = z.object({ messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(2000) })).min(1).max(10) });

/** Read-only Q&A. Data is cut to the signed-in person's organisational scope before the model sees any of it. */
export const POST = handle(async (req) => {
  const user = await requireApiUser(PERMS.assistant);
  if (!aiConfigured()) throw new ApiError(503, "The AI assistant isn't switched on yet. An administrator needs to add ANTHROPIC_API_KEY.");
  const { messages } = schema.parse(await req.json());
  if (messages.at(-1)!.role !== "user") throw new ApiError(400, "Ask a question first.");
  const { AiLog } = await getDb();
  if ((await AiLog.countDocuments({ user: user.id, createdAt: { $gte: new Date(Date.now() - 3600_000) } })) >= HOURLY_LIMIT) throw new ApiError(429, "You've reached the hourly limit for AI questions. Please try again a little later.");
  const t0 = Date.now(); const question = messages.at(-1)!.content;
  const L = await makeLoader(user);
  try {
    const r = await ask({ messages: messages.slice(-8), role: user.role, scope: await L.scopeLabel(), L, financeOk: true });
    const notice = accusationNotice(r.answer);
    await AiLog.create({ user: user.id, userName: user.name, role: user.role, kind: "ask", question: question.slice(0, 1000), answer: r.answer.slice(0, 4000), tools: r.tools, model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5", tokensIn: r.tokens.in, tokensOut: r.tokens.out, ms: Date.now() - t0 }).catch(() => {});
    return { answer: r.answer, used: r.used, notice };
  } catch (e: any) {
    await AiLog.create({ user: user.id, userName: user.name, role: user.role, kind: "ask", question: question.slice(0, 1000), error: String(e?.message || e).slice(0, 300), ms: Date.now() - t0 }).catch(() => {});
    throw new ApiError(502, e?.message || "The AI service didn't respond. Please try again.");
  }
});
