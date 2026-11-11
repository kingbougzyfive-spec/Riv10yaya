"use client";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Copy, Database, Loader2, Plus, RefreshCw, Star, Trash2, XCircle, Zap } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useConfirm, useTextPrompt } from "@/components/ui/ConfirmDialog";
import { api } from "@/lib/fetcher";
import { cn } from "@/lib/cn";

type C = {
  id: string; label: string; host: string; masked: string; source: "env" | "managed"; priority: number; enabled: boolean; isActive: boolean; isRunning: boolean;
  health?: { ok: boolean; latencyMs?: number; error?: string; checkedAt: string };
};

export function DatabaseManager() {
  const toast = useToast();
  const confirm = useConfirm();
  const askText = useTextPrompt();
  const [conns, setConns] = useState<C[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [add, setAdd] = useState(false);

  const load = useCallback(async (refresh = false) => {
    try { const r = await api(`/api/database${refresh ? "?refresh=1" : ""}`); setConns(r.connections); setNote(r.note); }
    catch (e: any) { toast.err(e.message); }
  }, [toast]);
  useEffect(() => { load(true); }, [load]);

  async function act(id: string, body: any, ok: string) {
    setBusy(id + body.action);
    try {
      const r = await api("/api/database", { method: "POST", json: { id, ...body } });
      toast.ok(body.action === "sync" ? `Copied ${Object.values(r.counts as Record<string, number>).reduce((a, b) => a + b, 0)} records` : ok);
      await load(true);
    } catch (e: any) { toast.err(e.message); }
    setBusy(null);
  }

  const healthy = conns?.filter((c) => c.enabled && c.health?.ok).length ?? 0;

  return (
    <>
      <div className="mb-5 flex flex-wrap gap-3">
        <button className="btn btn-primary" onClick={() => setAdd(true)}><Plus className="h-4 w-4" />Add database</button>
        <button className="btn btn-ghost" onClick={async () => { setBusy("refresh"); await load(true); setBusy(null); }}><RefreshCw className={cn("h-4 w-4", busy === "refresh" && "animate-spin")} />Re-check all</button>
      </div>

      {note && <p className="badge-warn mb-4 flex items-center gap-2 rounded-xl p-3 text-sm"><AlertTriangle className="h-4 w-4 shrink-0" />{note}</p>}

      <div className="glass mb-6 p-5 text-sm text-white/65">
        <p className="mb-2 font-bold text-white">How failover works</p>
        <ul className="list-inside list-disc space-y-1 text-[13px]">
          <li>The <b className="text-white">Active</b> database (star) is used first. If it's unreachable, the app switches to the next healthy one by priority number (lowest first).</li>
          <li>It automatically returns to the Active database once it's healthy again (checked every minute).</li>
          <li>A backup is only useful if it holds your data: use <b className="text-white">Copy data here</b> regularly to refresh it. Copying never deletes anything on the backup.</li>
        </ul>
        <p className="mt-3 text-xs text-white/65">{conns ? `${healthy} of ${conns.filter((c) => c.enabled).length} enabled connections healthy.` : ""}</p>
      </div>

      <div className="grid gap-4">
        {conns === null && [0, 1].map((i) => <div key={i} className="skeleton h-36" />)}
        {conns?.map((c, i) => (
          <motion.div key={c.id} layout initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className={cn("glass p-5", c.isRunning && "ring-1 ring-emerald-400/40")}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl", c.health?.ok ? "bg-emerald-500/15 text-emerald-300" : c.health ? "bg-red-500/15 text-red-300" : "bg-white/10 text-white/65")}><Database className="h-5 w-5" /></div>
                <div className="min-w-0">
                  <p className="flex items-center gap-2 truncate font-bold">{c.label}{c.isActive && <Star className="h-4 w-4 shrink-0 fill-accent text-accent" aria-label="Active" />}</p>
                  <p className="truncate text-xs text-white/65">{c.host}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {c.isRunning && <span className="badge badge-ok">In use now</span>}
                {c.isActive && !c.isRunning && <span className="badge badge-warn">Preferred (offline)</span>}
                <span className="badge">{c.source === "env" ? "Environment" : "Saved in app"}</span>
                {!c.enabled && <span className="badge badge-bad">Disabled</span>}
              </div>
            </div>
            <p className="mt-3 truncate rounded-lg bg-black/25 px-3 py-2 font-mono text-[11px] text-white/65">{c.masked}</p>
            <div className="mt-3 flex items-center gap-2 text-xs">
              {c.health?.ok ? <><CheckCircle2 className="h-4 w-4 text-emerald-400" /><span className="text-emerald-300">Healthy{c.health.latencyMs != null ? ` · ${c.health.latencyMs} ms` : ""}</span></> : c.health ? <><XCircle className="h-4 w-4 text-red-400" /><span className="text-red-300">{c.health.error || "Unreachable"}</span></> : <span className="text-white/65">Not checked yet</span>}
              <span className="ml-auto text-white/65">Priority {c.priority}</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {!c.isActive && c.enabled && <button className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => act(c.id, { action: "activate" }, "Switched. This database is now active.")}>{busy === c.id + "activate" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Star className="h-3.5 w-3.5" />}Make active</button>}
              {!c.isRunning && c.health?.ok && <button className="btn btn-ghost btn-sm" disabled={!!busy} onClick={async () => (await confirm({ title: `Copy data into "${c.label}"?`, message: "Existing records with the same ID will be overwritten; nothing is deleted.", confirmLabel: "Copy data", tone: "default" })) && act(c.id, { action: "sync" }, "")}>{busy === c.id + "sync" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}Copy data here</button>}
              {c.source === "managed" && <>
                <button className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => act(c.id, { action: "update", enabled: !c.enabled }, c.enabled ? "Disabled" : "Enabled")}>{c.enabled ? "Disable" : "Enable"}</button>
                <button className="btn btn-ghost btn-sm" disabled={!!busy} onClick={async () => { const v = await askText({ title: "Set priority", message: "1 = tried first after the active one", input: { label: "Priority", initial: String(c.priority) } }); if (v) act(c.id, { action: "update", priority: Number(v) }, "Priority saved"); }}>Priority</button>
                <button className="btn btn-ghost btn-sm" disabled={!!busy} onClick={async () => { const v = await askText({ title: "Rename connection", input: { label: "New name", initial: c.label } }); if (v) act(c.id, { action: "update", label: v }, "Renamed"); }}>Rename</button>
                <button className="btn btn-danger btn-sm ml-auto" disabled={!!busy} onClick={async () => (await confirm({ title: `Remove "${c.label}"?`, message: "The database itself is not touched.", confirmLabel: "Remove" })) && act(c.id, { action: "remove" }, "Removed")}><Trash2 className="h-3.5 w-3.5" />Remove</button>
              </>}
            </div>
          </motion.div>
        ))}
      </div>
      <AddDialog open={add} onClose={() => setAdd(false)} onDone={() => load(true)} />
    </>
  );
}

function AddDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [label, setLabel] = useState("");
  const [uri, setUri] = useState("");
  const [priority, setPriority] = useState(10);
  const [makeActive, setMakeActive] = useState(false);
  const [test, setTest] = useState<null | { ok: boolean; latencyMs?: number; error?: string }>(null);
  const [busy, setBusy] = useState<"test" | "save" | null>(null);
  useEffect(() => { if (open) { setLabel(""); setUri(""); setTest(null); setMakeActive(false); setPriority(10); } }, [open]);

  return (
    <Modal open={open} onClose={onClose} title="Add a MongoDB connection">
      <div className="space-y-4">
        <div><label className="label">Name</label><input className="input" placeholder="e.g. Backup – Atlas Frankfurt" value={label} onChange={(e) => setLabel(e.target.value)} /></div>
        <div><label className="label">Connection string</label><textarea className="input min-h-[96px] font-mono text-xs" value={uri} onChange={(e) => { setUri(e.target.value); setTest(null); }} placeholder="mongodb+srv://user:password@cluster.xxxxx.mongodb.net/yaya" /><p className="hint">Saved encrypted. Only a masked version is ever shown.</p></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Failover priority</label><input className="input" type="number" min={1} max={99} value={priority} onChange={(e) => setPriority(Number(e.target.value))} /></div>
          <label className="flex cursor-pointer items-end gap-2 pb-3 text-sm"><input type="checkbox" className="h-4 w-4 accent-emerald-500" checked={makeActive} onChange={(e) => setMakeActive(e.target.checked)} />Make active now</label>
        </div>
        <AnimatePresence>{test && <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={cn("rounded-xl p-3 text-sm", test.ok ? "badge-ok" : "badge-bad")}>{test.ok ? `Connected in ${test.latencyMs} ms.` : test.error}</motion.p>}</AnimatePresence>
        {makeActive && <p className="badge-warn rounded-xl p-3 text-xs">If this database is empty, the site will have no users or content until you copy data into it. Add it as a backup first, copy data, then make it active.</p>}
        <div className="flex gap-3">
          <button className="btn btn-ghost flex-1" disabled={busy !== null || uri.length < 10} onClick={async () => { setBusy("test"); try { setTest(await api("/api/database", { method: "POST", json: { action: "test", uri } })); } catch (e: any) { toast.err(e.message); } setBusy(null); }}>{busy === "test" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}Test</button>
          <button className="btn btn-primary flex-1" disabled={busy !== null || !test?.ok} onClick={async () => { setBusy("save"); try { await api("/api/database", { method: "POST", json: { action: "add", label, uri, priority, makeActive } }); toast.ok("Database added"); onDone(); onClose(); } catch (e: any) { toast.err(e.message); } setBusy(null); }}>{busy === "save" && <Loader2 className="h-4 w-4 animate-spin" />}Save</button>
        </div>
      </div>
    </Modal>
  );
}
