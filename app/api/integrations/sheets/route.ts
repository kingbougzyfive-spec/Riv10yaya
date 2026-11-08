import { z } from "zod";
import { audit, handle } from "@/lib/api";
import { ApiError, requireApiUser } from "@/lib/auth";
import { PERMS } from "@/lib/rbac";
import { SHEET_CONFIG_ROLES, SHEET_TABS, canSyncTab, isTabKey } from "@/lib/sheet-meta";
import { checkAccess, effectiveId, getConfig, retryFailed, runSync, saveConfig, tabEnabled, tabTitle } from "@/lib/sheet-sync";
import { sheetsCredsConfigured, sheetsServiceEmail } from "@/lib/sheets";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Status for the settings page: what's configured, per-tab state, last success, failures. */
export const GET = handle(async () => {
  const user = await requireApiUser(PERMS.integrations);
  const c = await getConfig(); const sid = effectiveId(c);
  const tabs = SHEET_TABS.filter((t) => canSyncTab(user.role, t.key) || SHEET_CONFIG_ROLES.includes(user.role)).map((t) => { const s = c.state[t.key] ?? {}; return { key: t.key, defaultName: t.tab, name: tabTitle(c, t.key), group: t.group, help: t.help, enabled: tabEnabled(c, t.key), canSync: canSyncTab(user.role, t.key), status: s.status ?? "never", okAt: s.okAt ?? null, rows: s.rows ?? null, error: s.error ?? null, errorAt: s.errorAt ?? null, attempts: s.attempts ?? 0, note: s.note ?? null }; });
  const okTimes = tabs.map((t) => t.okAt).filter(Boolean).sort() as string[];
  return {
    credentials: sheetsCredsConfigured(), serviceEmail: sheetsServiceEmail(), spreadsheetId: sid, fromEnv: !c.spreadsheetId && !!sid,
    url: sid ? `https://docs.google.com/spreadsheets/d/${sid}` : null,
    auto: c.auto, cronConfigured: !!process.env.CRON_SECRET, canConfigure: SHEET_CONFIG_ROLES.includes(user.role),
    running: !!c.lock && c.lock.until > Date.now(), lastRun: c.lastRun ?? null, lastOkAt: okTimes.at(-1) ?? null, failed: tabs.filter((t) => t.enabled && t.status === "failed").length, tabs,
  };
});

const cfgSchema = z.object({ spreadsheetId: z.string().max(300).optional(), auto: z.boolean().optional(), tabs: z.record(z.string(), z.boolean()).optional(), names: z.record(z.string(), z.string().max(100)).optional() });

export const PUT = handle(async (req) => {
  const user = await requireApiUser(SHEET_CONFIG_ROLES as any);
  const body = cfgSchema.parse(await req.json());
  try { await saveConfig(body); } catch (e: any) { throw new ApiError(400, e.message); }
  await audit(user, "sheets.config", "sheets", { spreadsheet: body.spreadsheetId !== undefined, auto: body.auto, tabs: body.tabs ? Object.keys(body.tabs) : undefined, names: body.names ? Object.keys(body.names) : undefined }, req);
  return { ok: true };
});

const actSchema = z.object({ action: z.enum(["sync", "retry", "test"]), tabs: z.array(z.string()).max(20).optional(), force: z.boolean().optional() });

export const POST = handle(async (req) => {
  const user = await requireApiUser(PERMS.integrations);
  const b = actSchema.parse(await req.json());
  if (b.action === "test") { const r = await checkAccess(); return r; }
  const who = { id: user.id, name: user.name, role: user.role };
  if (b.action === "retry") { const r = await retryFailed(who, "retry"); await audit(user, "sheets.retry", "sheets", r, req); return r; }
  const keys = (b.tabs ?? []).filter(isTabKey);
  if (b.tabs && keys.length !== b.tabs.length) throw new ApiError(400, "Unknown tab.");
  if (keys.some((k) => !canSyncTab(user.role, k))) throw new ApiError(403, "You can only sync the finance tabs.");
  const r = await runSync({ tabs: keys.length ? keys : undefined, trigger: "manual", user: who, force: b.force });
  await audit(user, "sheets.sync", "sheets", { tabs: keys.length ? keys : "all", ok: r.ok, failed: r.failed, skipped: r.skipped }, req);
  return r;
});
