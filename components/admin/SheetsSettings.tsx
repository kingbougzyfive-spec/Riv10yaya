"use client";
import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, RefreshCw, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { api } from "@/lib/fetcher";

const fmt = (v?: string | null) => (v ? new Date(v).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" }) : "—");
const ST: Record<string, string> = { ok: "badge badge-ok", failed: "badge badge-bad", skipped: "badge", never: "badge" };
const ST_LABEL: Record<string, string> = { ok: "Synced", failed: "Failed", never: "Not synced yet", skipped: "Unchanged" };

export function SheetsSettings() {
  const toast = useToast();
  const [s, setS] = useState<any>(null);
  const [sid, setSid] = useState("");
  const [names, setNames] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [view, setView] = useState<"tabs" | "log">("tabs");
  const [test, setTest] = useState<any>(null);

  const load = useCallback(async () => { try { const r = await api("/api/integrations/sheets"); setS(r); setSid((v) => v || r.spreadsheetId || ""); setNames((n) => (Object.keys(n).length ? n : Object.fromEntries(r.tabs.map((t: any) => [t.key, t.name])))); } catch (e: any) { toast.err(e.message); } }, [toast]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (!s?.running) return; const t = setInterval(load, 4000); return () => clearInterval(t); }, [s?.running, load]);

  const act = async (key: string, fn: () => Promise<any>) => { setBusy(key); try { await fn(); } catch (e: any) { toast.err(e.message); } setBusy(""); load(); };
  const sync = (tabs?: string[], force = false) => act(tabs?.[0] ?? "all", async () => { const r = await api("/api/integrations/sheets", { method: "POST", json: { action: "sync", tabs, force } }); r.failed ? toast.err(`${r.failed} tab${r.failed === 1 ? "" : "s"} failed. See the details below.`) : toast.ok(r.note ?? `${r.ok} updated, ${r.skipped} unchanged`); });
  const retry = () => act("retry", async () => { const r = await api("/api/integrations/sheets", { method: "POST", json: { action: "retry" } }); r.failed ? toast.err(`${r.failed} still failing`) : toast.ok(r.note ?? `${r.ok} fixed`); });
  const save = (patch: any) => act("save", async () => { await api("/api/integrations/sheets", { method: "PUT", json: patch }); toast.ok("Saved"); });
  const runTest = () => act("test", async () => { const r = await api("/api/integrations/sheets", { method: "POST", json: { action: "test" } }); setTest(r); });

  if (!s) return <div className="grid gap-4"><div className="skeleton h-40" /><div className="skeleton h-72" /></div>;
  const ready = s.credentials && !!s.spreadsheetId;
  const finance = s.tabs.filter((t: any) => t.group === "finance"), other = s.tabs.filter((t: any) => t.group !== "finance");

  const Row = ({ t }: { t: any }) => (
    <div className="flex flex-wrap items-center gap-3 border-b border-white/5 px-4 py-3 last:border-0">
      {s.canConfigure && <input type="checkbox" className="h-4 w-4" checked={t.enabled} onChange={(e) => save({ tabs: { [t.key]: e.target.checked } })} aria-label={`Sync ${t.defaultName}`} />}
      <div className="min-w-[200px] flex-1">
        {s.canConfigure ? <input className="input !py-1.5 font-semibold" value={names[t.key] ?? t.name} onChange={(e) => setNames({ ...names, [t.key]: e.target.value })} onBlur={() => names[t.key] !== t.name && save({ names: { [t.key]: names[t.key] } })} aria-label="Tab name" /> : <p className="font-semibold">{t.name}</p>}
        <p className="mt-0.5 text-xs text-white/50">{t.help}</p>
        {t.status === "failed" && <p className="mt-1 flex items-start gap-1.5 text-xs text-red-300"><AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />{t.error} <span className="text-white/40">({fmt(t.errorAt)}, attempt {t.attempts})</span></p>}
        {t.note && t.status === "ok" && <p className="mt-1 text-xs text-amber-300">{t.note}</p>}
      </div>
      <div className="w-28 text-xs text-white/55">{t.rows !== null ? `${t.rows.toLocaleString("en-NG")} rows` : ""}<br />{fmt(t.okAt)}</div>
      <span className={ST[t.enabled ? t.status : "skipped"]}>{t.enabled ? ST_LABEL[t.status] : "Off"}</span>
      <button className="btn btn-ghost btn-sm" disabled={!ready || !t.enabled || !t.canSync || !!busy || s.running} onClick={() => sync([t.key], t.status === "failed")}>{busy === t.key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}Sync</button>
    </div>
  );

  return (
    <div className="space-y-5">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="grid gap-3 sm:grid-cols-3">
        <div className="glass p-4"><p className="text-xs uppercase tracking-wide text-white/50">Last successful sync</p><p className="mt-1 flex items-center gap-2 font-bold">{s.lastOkAt ? <><CheckCircle2 className="h-4 w-4 text-emerald-400" />{fmt(s.lastOkAt)}</> : "Never"}</p></div>
        <div className="glass p-4"><p className="text-xs uppercase tracking-wide text-white/50">Failed tabs</p><p className={cn("mt-1 text-2xl font-extrabold", s.failed ? "text-red-300" : "text-emerald-300")}>{s.failed}</p></div>
        <div className="glass p-4"><p className="text-xs uppercase tracking-wide text-white/50">Last run</p><p className="mt-1 text-sm font-semibold">{s.running ? <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Running…</span> : s.lastRun ? `${fmt(s.lastRun.at)} · ${s.lastRun.trigger === "auto" ? "automatic" : s.lastRun.trigger}` : "—"}</p>{s.lastRun && !s.running && <p className="text-xs text-white/50">{s.lastRun.ok} updated · {s.lastRun.skipped} unchanged · {s.lastRun.failed} failed</p>}</div>
      </motion.div>

      <div className="glass space-y-4 p-5">
        <p className="font-bold">Connection</p>
        {!s.credentials ? <p className="text-sm text-amber-300">The Google service account key isn't set. Add <code>GOOGLE_SERVICE_ACCOUNT_JSON</code> to the environment (see the steps on the Integrations page).</p> : (
          <p className="text-sm text-white/70">Share your spreadsheet with <b className="break-all text-white">{s.serviceEmail}</b> as an <b>Editor</b>. Only spreadsheets that account can open are used; if it can't open the sheet, nothing is sent.</p>
        )}
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[260px] flex-1"><label className="label">Spreadsheet link or ID</label><input className="input" value={sid} disabled={!s.canConfigure} placeholder="https://docs.google.com/spreadsheets/d/…" onChange={(e) => setSid(e.target.value)} />{s.fromEnv && <p className="hint">Currently taken from GOOGLE_SHEET_ID. Saving a value here overrides it.</p>}</div>
          {s.canConfigure && <button className="btn btn-primary" disabled={!!busy || sid === s.spreadsheetId} onClick={() => save({ spreadsheetId: sid })}>Save</button>}
          <button className="btn btn-ghost" disabled={!ready || !!busy} onClick={runTest}>{busy === "test" && <Loader2 className="h-4 w-4 animate-spin" />}Test connection</button>
          {s.url && <a className="btn btn-ghost" href={s.url} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" />Open</a>}
        </div>
        {test && <p className={cn("rounded-xl p-3 text-sm", test.ok ? "bg-emerald-500/10 text-emerald-200" : "bg-red-500/10 text-red-200")}>{test.ok ? `Connected to “${test.title}” (${test.tabs.length} tab${test.tabs.length === 1 ? "" : "s"} found).` : test.error}</p>}
        {s.canConfigure && <label className="flex flex-wrap items-center gap-2 text-sm"><input type="checkbox" checked={s.auto} onChange={(e) => save({ auto: e.target.checked })} />Sync automatically every morning (about 06:30 Lagos) and retry anything that failed{!s.cronConfigured && <span className="badge badge-warn">needs CRON_SECRET</span>}</label>}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="glass flex gap-1 p-1">{(["tabs", "log"] as const).map((v) => <button key={v} onClick={() => setView(v)} className={cn("rounded-xl px-4 py-1.5 text-sm font-semibold", view === v ? "bg-brand text-[#04130d]" : "text-white/60")}>{v === "tabs" ? "Tabs" : "Sync log"}</button>)}</div>
        <span className="flex-1" />
        <button className="btn btn-ghost" disabled={!ready || !!busy || s.running || !s.failed} onClick={retry}>{busy === "retry" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}Retry failed ({s.failed})</button>
        <button className="btn btn-primary" disabled={!ready || !!busy || s.running} onClick={() => sync()}>{busy === "all" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}Sync all now</button>
        <button className="btn btn-ghost btn-sm" disabled={!ready || !!busy || s.running} onClick={() => sync(undefined, true)} title="Rewrite every tab even if nothing changed">Force full rewrite</button>
      </div>

      {view === "tabs" && <>
        {finance.length > 0 && <div className="glass overflow-hidden"><p className="border-b border-white/10 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-white/50">Finance · confirmed, pending and rejected money kept apart</p>{finance.map((t: any) => <Row key={t.key} t={t} />)}</div>}
        {other.length > 0 && <div className="glass overflow-hidden"><p className="border-b border-white/10 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-white/50">Registers, attendance, events and reports</p>{other.map((t: any) => <Row key={t.key} t={t} />)}</div>}
        <p className="text-xs text-white/45">Each sync replaces a tab with a fresh copy from the database, so rows are never duplicated and a repeat does no harm. Tabs with no changes since the last success are skipped. Anything typed into the spreadsheet is overwritten and never read back.</p>
      </>}
      {view === "log" && <Log tabs={s.tabs} />}
    </div>
  );
}

function Log({ tabs }: { tabs: any[] }) {
  const toast = useToast();
  const [rows, setRows] = useState<any[] | null>(null);
  const [tab, setTab] = useState(""); const [status, setStatus] = useState("");
  useEffect(() => { setRows(null); api(`/api/integrations/sheets/logs?${new URLSearchParams({ ...(tab ? { tab } : {}), ...(status ? { status } : {}) })}`).then((r) => setRows(r.rows)).catch((e) => { toast.err(e.message); setRows([]); }); }, [tab, status, toast]);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3"><select className="input !w-auto" value={tab} onChange={(e) => setTab(e.target.value)}><option value="">All tabs</option>{tabs.map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}</select><select className="input !w-auto" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Any result</option><option value="ok">Updated</option><option value="failed">Failed</option><option value="skipped">Unchanged</option></select></div>
      {!rows && <div className="skeleton h-24" />}
      <div className="space-y-1.5">{rows?.map((l) => (
        <div key={l.id} className="glass flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
          <div className="min-w-0"><p className="truncate font-semibold">{l.tab}</p><p className="text-xs text-white/50">{fmt(l.at)} · {l.trigger === "auto" ? "automatic" : l.trigger}{l.byName ? ` · ${l.byName}` : ""}{l.rows !== null ? ` · ${l.rows.toLocaleString("en-NG")} rows` : ""}{l.ms !== null ? ` · ${(l.ms / 1000).toFixed(1)}s` : ""}</p>{(l.error || l.note) && <p className={cn("text-xs", l.error ? "text-red-300" : "text-white/50")}>{l.error || l.note}</p>}</div>
          <span className={ST[l.status]}>{l.status === "ok" ? "Updated" : l.status === "failed" ? "Failed" : "Unchanged"}</span>
        </div>))}
        {rows?.length === 0 && <div className="glass p-10 text-center text-white/50">Nothing logged yet.</div>}</div>
    </div>
  );
}
