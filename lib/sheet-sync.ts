import { getDb } from "./db";
import { BAD_TAB_CHARS, SHEET_TABS, TAB_BY_KEY, canSyncTab, isTabKey, type SheetTabKey } from "./sheet-meta";
import { BUILDERS, makeContext } from "./sheet-tabs";
import { stamp } from "./sheet-rows";
import { addTabs, envSheetId, parseSheetId, replaceTab, sheetsConfigured, sheetsServiceEmail, spreadsheetInfo, type Cell, type TabInfo } from "./sheets";
import { createHash, randomUUID } from "crypto";

export type TabState = { hash?: string; status?: "ok" | "failed"; okAt?: string; rows?: number; error?: string; errorAt?: string; attempts?: number; note?: string };
export type SheetConfig = { spreadsheetId: string; auto: boolean; tabs: Partial<Record<SheetTabKey, boolean>>; names: Partial<Record<SheetTabKey, string>>; state: Partial<Record<SheetTabKey, TabState>>; lock?: { until: number } | null; lastRun?: { at: string; trigger: string; ok: number; failed: number; skipped: number } };
export type Trigger = "manual" | "auto" | "retry";
const KEY = "sheets";

export async function getConfig(): Promise<SheetConfig> {
  const d = await (await getDb()).SystemConfig.findOne({ key: KEY }).lean<any>();
  const v = d?.value ?? {};
  return { spreadsheetId: v.spreadsheetId ?? "", auto: v.auto ?? false, tabs: v.tabs ?? {}, names: v.names ?? {}, state: v.state ?? {}, lock: v.lock ?? null, lastRun: v.lastRun };
}
export const effectiveId = (c: SheetConfig) => c.spreadsheetId || envSheetId();
export const tabEnabled = (c: SheetConfig, k: SheetTabKey) => c.tabs[k] !== false;
export const tabTitle = (c: SheetConfig, k: SheetTabKey) => (c.names[k]?.trim() || TAB_BY_KEY[k].tab);

export async function saveConfig(patch: { spreadsheetId?: string; auto?: boolean; tabs?: Record<string, boolean>; names?: Record<string, string> }) {
  const set: Record<string, unknown> = {};
  if (patch.spreadsheetId !== undefined) {
    const id = patch.spreadsheetId.trim() === "" ? "" : parseSheetId(patch.spreadsheetId);
    if (patch.spreadsheetId.trim() && !id) throw new Error("That doesn't look like a Google Sheets link or ID.");
    set["value.spreadsheetId"] = id;
  }
  if (patch.auto !== undefined) set["value.auto"] = patch.auto;
  for (const [k, on] of Object.entries(patch.tabs ?? {})) if (isTabKey(k)) set[`value.tabs.${k}`] = !!on;
  const titles = Object.entries(patch.names ?? {}).filter(([k]) => isTabKey(k)).map(([k, v]) => [k, v.trim()] as const);
  for (const [k, v] of titles) {
    if (v.length > 90 || BAD_TAB_CHARS.test(v)) throw new Error(`“${v}” can't be used as a tab name (max 90 characters, none of [ ] * ? : / \\).`);
    set[`value.names.${k}`] = v;
  }
  // two tabs must never share a title or one would overwrite the other
  const cfg = await getConfig();
  const merged = new Map(SHEET_TABS.map((t) => [t.key, (patch.names?.[t.key] !== undefined ? patch.names[t.key].trim() : cfg.names[t.key])?.trim() || t.tab]));
  const seen = new Set<string>();
  for (const v of merged.values()) { const l = v.toLowerCase(); if (seen.has(l) || l === "sync info") throw new Error(`Tab name “${v}” is used twice (or reserved).`); seen.add(l); }
  if (Object.keys(set).length) await (await getDb()).SystemConfig.updateOne({ key: KEY }, { $set: set }, { upsert: true });
  return getConfig();
}

async function setState(k: SheetTabKey, s: TabState) { await (await getDb()).SystemConfig.updateOne({ key: KEY }, { $set: { [`value.state.${k}`]: s } }, { upsert: true }); }

/** One run at a time: a second click or an overlapping cron call gets a clear message instead of a double write. */
async function acquire(minutes = 4): Promise<boolean> {
  const { SystemConfig } = await getDb(); const now = Date.now();
  await SystemConfig.updateOne({ key: KEY }, { $setOnInsert: { value: {} } }, { upsert: true }).catch(() => {});
  const r = await SystemConfig.updateOne({ key: KEY, $or: [{ "value.lock": null }, { "value.lock.until": { $lt: now } }, { "value.lock": { $exists: false } }] }, { $set: { "value.lock": { until: now + minutes * 60_000 } } });
  return r.modifiedCount > 0;
}
async function release() { await (await getDb()).SystemConfig.updateOne({ key: KEY }, { $set: { "value.lock": null } }); }

export const hashTable = (head: string[], rows: Cell[][]) => createHash("sha256").update(JSON.stringify([head, rows])).digest("hex");
const errText = (e: any) => String(e?.message || e || "Unknown error").slice(0, 500);

export type RunResult = { run: string; ok: number; failed: number; skipped: number; note?: string };
type Opts = { tabs?: SheetTabKey[]; trigger: Trigger; user?: { id: string; name: string; role: string } | null; force?: boolean; budgetMs?: number };

/** Test the connection and report what the Google account can open. Sends nothing. */
export async function checkAccess() {
  const cfg = await getConfig(); const sid = effectiveId(cfg);
  if (!sheetsConfigured(sid)) return { ok: false as const, error: "Add the service account key and a spreadsheet first." };
  try { const i = await spreadsheetInfo(sid); return { ok: true as const, title: i.title, tabs: i.tabs.map((t) => t.title) }; }
  catch (e: any) { return { ok: false as const, error: errText(e) }; }
}

/**
 * Database → spreadsheet, one way. For each selected tab: build the snapshot from MongoDB, skip if it's identical to
 * the last successful one, otherwise replace the whole tab. Failures are logged per tab and never stop the others.
 */
export async function runSync(o: Opts): Promise<RunResult> {
  const { SheetSyncLog } = await getDb();
  const run = randomUUID(); const t0 = Date.now(); const budget = o.budgetMs ?? 50_000;
  const cfg = await getConfig(); const sid = effectiveId(cfg);
  const log = (tabKey: string, tab: string, status: "ok" | "failed" | "skipped", extra: Record<string, unknown> = {}) => SheetSyncLog.create({ run, tabKey, tab, trigger: o.trigger, status, by: o.user?.id, byName: o.user?.name ?? (o.trigger === "manual" ? undefined : "Automatic"), ...extra }).catch(() => {});
  const res: RunResult = { run, ok: 0, failed: 0, skipped: 0 };

  if (!sheetsConfigured(sid)) { await log("-", "-", "failed", { error: "Google Sheets isn't configured." }); return { ...res, failed: 1, note: "Google Sheets isn't configured." }; }
  const wanted = (o.tabs ?? SHEET_TABS.map((t) => t.key)).filter((k) => tabEnabled(cfg, k) && (!o.user || canSyncTab(o.user.role, k)));
  if (!wanted.length) return { ...res, note: "No tabs to sync." };
  if (!(await acquire())) return { ...res, note: "A sync is already running. Try again in a minute." };
  try {
    // Prove access first: if the Google account can't open the spreadsheet, no data is built or sent.
    let info; try { info = await spreadsheetInfo(sid); } catch (e: any) {
      for (const k of wanted) { const prev = cfg.state[k] ?? {}; await setState(k, { ...prev, status: "failed", error: errText(e), errorAt: new Date().toISOString(), attempts: (prev.attempts ?? 0) + 1 }); await log(k, tabTitle(cfg, k), "failed", { error: errText(e) }); res.failed++; }
      return { ...res, note: errText(e) };
    }
    const have = new Map<string, TabInfo>(info.tabs.map((t) => [t.title, t]));
    const ctx = makeContext();
    const done: { key: SheetTabKey; rows: number }[] = [];
    for (const k of wanted) {
      const title = tabTitle(cfg, k); const prev = cfg.state[k] ?? {}; const s0 = Date.now();
      if (Date.now() - t0 > budget) { await log(k, title, "skipped", { note: "Ran out of time; will be picked up next run." }); res.skipped++; continue; }
      try {
        const t = await BUILDERS[k](ctx);
        const hash = hashTable(t.head, t.rows);
        if (!o.force && prev.status === "ok" && prev.hash === hash && have.has(title)) { await log(k, title, "skipped", { rows: t.rows.length, note: "No changes since the last sync.", ms: Date.now() - s0 }); res.skipped++; done.push({ key: k, rows: t.rows.length }); continue; }
        if (!have.has(title)) { await addTabs(sid, [title]); const again = await spreadsheetInfo(sid); again.tabs.forEach((x) => have.set(x.title, x)); }
        const n = await replaceTab(sid, have.get(title)!, t.head, t.rows);
        const note = t.warnings.join("; ") || undefined;
        await setState(k, { hash, status: "ok", okAt: new Date().toISOString(), rows: n, attempts: 0, note });
        await log(k, title, "ok", { rows: n, ms: Date.now() - s0, note }); res.ok++; done.push({ key: k, rows: n });
      } catch (e: any) {
        // the tab may be half-written, so forget the hash: the next run rewrites it in full
        await setState(k, { ...prev, hash: undefined, status: "failed", error: errText(e), errorAt: new Date().toISOString(), attempts: (prev.attempts ?? 0) + 1 });
        await log(k, title, "failed", { error: errText(e), ms: Date.now() - s0 }); res.failed++;
      }
    }
    if (res.ok > 0) await writeInfo(sid, have, cfg, done).catch(() => {});
    await (await getDb()).SystemConfig.updateOne({ key: KEY }, { $set: { "value.lastRun": { at: new Date().toISOString(), trigger: o.trigger, ok: res.ok, failed: res.failed, skipped: res.skipped } } });
    return res;
  } finally { await release(); }
}

/** A short explanatory tab so anyone opening the spreadsheet knows it is a read-only copy. */
async function writeInfo(sid: string, have: Map<string, TabInfo>, cfg: SheetConfig, done: { key: SheetTabKey; rows: number }[]) {
  const title = "Sync Info";
  if (!have.has(title)) { await addTabs(sid, [title]); const again = await spreadsheetInfo(sid); again.tabs.forEach((x) => have.set(x.title, x)); }
  const rows: Cell[][] = [
    ["Source", "RCCG Rivers 10 YAYA platform database (MongoDB). This spreadsheet is a read-only reporting copy."],
    ["Last synced", stamp(new Date()) + " (Lagos time)"],
    ["Edits", "Changes made here are overwritten on the next sync and never reach the platform. Share this sheet as Viewer with anyone who doesn't maintain it."],
    ["Money", "“Confirmed” means finance verified it in the bank. Pending, needs-action and rejected payments are shown separately and are never counted as received."],
    ["Record ID", "Column A of every tab is the database ID. Each row appears once."],
    ["Privacy", "No phone numbers or emails of members or registrants are sent. Under-18 registrant names are withheld."],
    ["", ""],
    ...SHEET_TABS.filter((t) => tabEnabled(cfg, t.key)).map((t) => [tabTitle(cfg, t.key), `${(done.find((d) => d.key === t.key)?.rows ?? cfg.state[t.key]?.rows ?? 0).toLocaleString("en-NG")} rows`] as Cell[]),
  ];
  await replaceTab(sid, have.get(title)!, ["Item", "Details"], rows);
}

/** Re-run every tab whose last attempt failed. Forced, because a failed tab may be half-written. */
export async function retryFailed(user?: Opts["user"], trigger: Trigger = "retry") {
  const cfg = await getConfig();
  const keys = SHEET_TABS.map((t) => t.key).filter((k) => cfg.state[k]?.status === "failed" && tabEnabled(cfg, k));
  if (!keys.length) return { run: "", ok: 0, failed: 0, skipped: 0, note: "Nothing to retry." } as RunResult;
  return runSync({ tabs: keys, trigger, user, force: true });
}

export const serviceEmail = sheetsServiceEmail;
