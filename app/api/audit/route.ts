import { handle } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { PERMS } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export const GET = handle(async (req) => {
  await requireApiUser(PERMS.audit);
  const limit = Math.min(200, Number(new URL(req.url).searchParams.get("limit")) || 100);
  const { Audit } = await getDb();
  const rows = await Audit.find().sort({ createdAt: -1 }).limit(limit).lean<any[]>();
  return { rows: rows.map((r) => ({ id: String(r._id), action: r.action, actorName: r.actorName, target: r.target, ip: r.ip, at: r.createdAt })) };
});
