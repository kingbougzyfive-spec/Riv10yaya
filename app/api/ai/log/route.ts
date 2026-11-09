import { handle } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { isProvincialAdmin } from "@/lib/governance";
import { PERMS } from "@/lib/rbac";

export const dynamic = "force-dynamic";

/** Provincial administrators can review what the assistant was asked and which data it read. Everyone else sees only their own. */
export const GET = handle(async () => {
  const user = await requireApiUser([...new Set([...PERMS.assistant, ...PERMS.aiWrite])] as any);
  const { AiLog } = await getDb();
  const rows = await AiLog.find(isProvincialAdmin(user.role) ? {} : { user: user.id }).sort({ createdAt: -1 }).limit(100).lean<any[]>();
  return { all: isProvincialAdmin(user.role), rows: rows.map((l) => ({ id: String(l._id), at: l.createdAt, who: l.userName, role: l.role, kind: l.kind, question: l.question, answer: l.answer, tools: (l.tools ?? []).map((t: any) => ({ name: t.name, args: t.args, error: t.error })), error: l.error ?? null, tokens: (l.tokensIn ?? 0) + (l.tokensOut ?? 0) })) };
});
