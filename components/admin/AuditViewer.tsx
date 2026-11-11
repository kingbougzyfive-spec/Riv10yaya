"use client";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Download, Loader2, Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/fetcher";

type Row = { id: string; at: string; action: string; actorName: string | null; actorEmail: string | null; actorRole: string | null; target: string | null; entity: string | null; entityId: string | null; before: any; after: any; reason: string | null; detail: any; ip: string | null; userAgent: string | null };

const GROUPS: [string, string][] = [["", "Everything"], ["auth.*", "Sign-ins and passwords"], ["user.*", "Users and roles"], ["org.*", "Organisation changes"], ["remittance.*", "Payments and approvals"], ["evidence.*", "Receipt uploads"], ["finance.*", "Finance settings"], ["report.*", "Reports"], ["export.*", "Data exports"], ["member.*", "Member records"], ["sheets.*", "Google Sheets"], ["attendance.*", "Attendance corrections"]];

const Json = ({ v }: { v: any }) => (v == null ? <span className="text-white/65">none</span> : <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-black/30 p-2 text-[11px] leading-relaxed text-white/75">{JSON.stringify(v, null, 2)}</pre>);

/** Read-only. Every row shows who, role, what, which record, before and after, when and why. */
export function AuditViewer() {
  const [f, setF] = useState({ group: "", actor: "", q: "", from: "", to: "" });
  const [rows, setRows] = useState<Row[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const qs = useCallback((extra: Record<string, string> = {}) => {
    const p = new URLSearchParams();
    if (f.group) p.set("action", f.group);
    if (f.actor) p.set("actor", f.actor);
    if (f.q) p.set("q", f.q);
    if (f.from) p.set("from", f.from);
    if (f.to) p.set("to", f.to);
    for (const [k, v] of Object.entries(extra)) p.set(k, v);
    return p.toString();
  }, [f]);

  const load = useCallback(async (more = false) => {
    setBusy(true); setErr("");
    try {
      const r = await api(`/api/audit?${qs(more && next ? { before: next } : {})}`);
      setRows((cur) => (more && cur ? [...cur, ...r.rows] : r.rows)); setNext(r.next);
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  }, [qs, next]);

  useEffect(() => { const t = setTimeout(() => load(false), 250); return () => clearTimeout(t); /* eslint-disable-next-line */ }, [f]);

  return (
    <div className="space-y-4">
      <div className="glass grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
        <div><label className="label">What</label><select className="input" value={f.group} onChange={(e) => setF({ ...f, group: e.target.value })}>{GROUPS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        <div><label className="label">Who</label><input className="input" placeholder="Name or email" value={f.actor} onChange={(e) => setF({ ...f, actor: e.target.value })} /></div>
        <div><label className="label">Record or reason</label><div className="relative"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-white/65" /><input className="input pl-9" placeholder="Search" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} /></div></div>
        <div><label className="label">From</label><input className="input" type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></div>
        <div><label className="label">To</label><input className="input" type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></div>
      </div>
      <div className="flex justify-end">
        <a className="btn btn-ghost btn-sm" href={`/api/audit?${qs({ format: "csv" })}`}><Download className="h-4 w-4" />Download these rows (CSV)</a>
      </div>
      {err && <p className="text-sm text-red-300">{err}</p>}
      <div className="glass overflow-hidden p-0">
        {rows === null ? <div className="p-8 text-center text-white/65"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div> : rows.length === 0 ? <p className="p-8 text-center text-white/65">Nothing matches.</p> : (
          <ul className="divide-y divide-white/10">
            {rows.map((r) => (
              <li key={r.id}>
                <button className="flex w-full items-start gap-3 p-4 text-left hover:bg-white/5" onClick={() => setOpen(open === r.id ? null : r.id)}>
                  <ChevronDown className={`mt-1 h-4 w-4 shrink-0 text-white/65 transition ${open === r.id ? "rotate-180" : ""}`} />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-x-3 gap-y-1"><span className="font-mono text-xs text-brand">{r.action}</span><span className="truncate text-sm">{r.target ?? ""}</span></p>
                    <p className="mt-0.5 text-xs text-white/65">{r.actorName ?? "System"}{r.actorRole ? ` · ${r.actorRole.replace(/_/g, " ")}` : ""} · {new Date(r.at).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "medium" })}</p>
                  </div>
                </button>
                <AnimatePresence initial={false}>
                  {open === r.id && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="grid gap-3 px-4 pb-4 pl-11 text-xs sm:grid-cols-2">
                        <div><p className="mb-1 font-bold uppercase tracking-wide text-white/65">Before</p><Json v={r.before} /></div>
                        <div><p className="mb-1 font-bold uppercase tracking-wide text-white/65">After</p><Json v={r.after} /></div>
                        {r.reason && <p className="sm:col-span-2"><b className="text-white/65">Reason: </b>{r.reason}</p>}
                        {r.detail && <div className="sm:col-span-2"><p className="mb-1 font-bold uppercase tracking-wide text-white/65">Other details</p><Json v={r.detail} /></div>}
                        <p className="text-white/65 sm:col-span-2">{r.actorEmail && <>Email {r.actorEmail} · </>}{r.entity && <>Record {r.entity}{r.entityId ? ` ${r.entityId}` : ""} · </>}{r.ip && <>From {r.ip}</>}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </li>
            ))}
          </ul>
        )}
      </div>
      {next && <div className="text-center"><button className="btn btn-ghost" disabled={busy} onClick={() => load(true)}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Show older entries</button></div>}
    </div>
  );
}
