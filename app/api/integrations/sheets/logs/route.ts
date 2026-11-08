import { handle } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { PERMS } from "@/lib/rbac";
import { SHEET_TABS, canSyncTab, isTabKey } from "@/lib/sheet-meta";

export const dynamic = "force-dynamic";

export const GET = handle(async (req) => {
  const user = await requireApiUser(PERMS.integrations);
  const q = new URL(req.url).searchParams;
  const allowed = SHEET_TABS.map((t) => t.key).filter((k) => canSyncTab(user.role, k));
  const f: any = { tabKey: { $in: [...allowed, ...(user.role === "finance_admin" ? [] : ["-"])] } };
  const tab = q.get("tab"); if (tab && isTabKey(tab) && allowed.includes(tab)) f.tabKey = tab;
  const st = q.get("status"); if (st && ["ok", "failed", "skipped"].includes(st)) f.status = st;
  const { SheetSyncLog } = await getDb();
  const rows = await SheetSyncLog.find(f).sort({ createdAt: -1 }).limit(150).lean<any[]>();
  return { rows: rows.map((l) => ({ id: String(l._id), at: l.createdAt, run: l.run, tabKey: l.tabKey, tab: l.tab, trigger: l.trigger, status: l.status, rows: l.rows ?? null, ms: l.ms ?? null, error: l.error ?? null, note: l.note ?? null, byName: l.byName ?? null })) };
});
