import { handle, audit } from "@/lib/api";
import { ApiError, requireApiUser } from "@/lib/auth";
import { aiConfigured } from "@/lib/ai-receipt";
import { runAnalysis } from "@/lib/receipt-analysis";
import { PERMS } from "@/lib/rbac";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
type Ctx = { params: Promise<{ id: string }> };

export const POST = handle<Ctx>(async (req, ctx) => {
  const user = await requireApiUser(PERMS.financeReview);
  if (!aiConfigured()) throw new ApiError(400, "AI receipt reading isn't set up. Ask the Super Administrator to add ANTHROPIC_API_KEY (Admin → Integrations).");
  const { id } = await ctx.params;
  const paymentId = new URL(req.url).searchParams.get("paymentId");
  return { analysis: await runAnalysis(id, paymentId, user, req) };
});
