import { handle } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { isProvincialAdmin } from "@/lib/governance";
import { PERMS } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export const shapeLog = (l: any) => ({ id: String(l._id), at: l.createdAt, origin: l.origin, event: l.event, category: l.category, title: l.title, audience: l.audience, channels: l.channels, sentByName: l.sentByName, totals: l.totals, status: l.status, failures: (l.failures ?? []).filter((f: any) => !f.retried).length });

/** Delivery log. Senders see their own sends; provincial administrators see everything, including system events. */
export const GET = handle(async (req) => {
  const user = await requireApiUser(PERMS.comms);
  const q = new URL(req.url).searchParams;
  const f: any = {};
  const prov = isProvincialAdmin(user.role);
  f.origin = prov && q.get("origin") === "system" ? "system" : "manual";
  if (!prov) f.sentBy = user.id;
  if (q.get("status") === "problems") f.status = { $in: ["partial", "failed"] };
  const { NotificationLog } = await getDb();
  const rows = await NotificationLog.find(f, { failures: 1, title: 1, createdAt: 1, origin: 1, event: 1, category: 1, audience: 1, channels: 1, sentByName: 1, totals: 1, status: 1 }).sort({ createdAt: -1 }).limit(100).lean<any[]>();
  return { rows: rows.map(shapeLog), canSeeSystem: prov };
});
