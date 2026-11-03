"use client";
import { Download, LayoutGrid, Loader2, Lock, LockOpen, Printer, RefreshCw, Trash2, UserPlus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { QrCode, useQr } from "@/components/Qr";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/fetcher";
import { fmtDT } from "@/lib/dates";
import { cn } from "@/lib/cn";

export function SessionDetail({ id, canManage }: { id: string; canManage: boolean }) {
  const toast = useToast();
  const [d, setD] = useState<any>(null);
  const [origin, setOrigin] = useState("");
  const [add, setAdd] = useState({ name: "", phone: "", note: "" });
  const [busy, setBusy] = useState("");
  const load = useCallback(() => api(`/api/attendance/sessions/${id}`).then(setD).catch((e) => toast.err(e.message)), [id, toast]);
  useEffect(() => { setOrigin(window.location.origin); load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, [load]);
  const url = d && origin ? `${origin}/attend/${d.session.token}` : "";
  const png = useQr(url || "x", 1024);
  const run = async (key: string, fn: () => Promise<any>, ok: string) => { setBusy(key); try { await fn(); toast.ok(ok); await load(); } catch (e: any) { toast.err(e.message); } setBusy(""); };

  if (!d) return <div className="space-y-4"><div className="skeleton h-72" /><div className="skeleton h-48" /></div>;
  const s = d.session;
  const state = s.forceClosed ? "closed" : Date.now() < +new Date(s.opensAt) ? "scheduled" : Date.now() > +new Date(s.closesAt) ? "closed" : "open";
  return (
    <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
      <div className="space-y-4">
        <div className="glass p-6 text-center">
          <span className={cn("badge capitalize", state === "open" ? "badge-ok" : state === "scheduled" ? "badge-warn" : "")}>{state}</span>
          <h2 className="mt-3 text-lg font-black">{s.title}</h2>
          <p className="text-xs text-white/45">{[s.zone, s.area, s.parish].filter(Boolean).join(" → ") || "Province-wide"}</p>
          <p className="text-xs text-white/45">{fmtDT(s.opensAt)} – {fmtDT(s.closesAt)}</p>
          <div className="my-5 flex justify-center">{url ? <QrCode value={url} size={240} /> : <div className="skeleton h-60 w-60" />}</div>
          <p className="break-all text-[11px] text-white/35">{url}</p>
          <div className="mt-5 grid gap-2">
            <a className="btn btn-primary" href={png} download={`attendance-${s.title.replace(/\W+/g, "-")}.png`}><Download className="h-4 w-4" />Download PNG</a>
            <a className="btn btn-ghost" target="_blank" href={`/print/attendance/${id}?layout=poster`}><Printer className="h-4 w-4" />Poster (print / save as PDF)</a>
            <a className="btn btn-ghost" target="_blank" href={`/print/attendance/${id}?layout=stickers`}><LayoutGrid className="h-4 w-4" />Sticker sheet</a>
          </div>
        </div>
        {canManage && (
          <div className="glass space-y-2 p-5">
            {state === "open" ? <button className="btn btn-ghost w-full" disabled={!!busy} onClick={() => run("close", () => api(`/api/attendance/sessions/${id}`, { method: "PATCH", json: { forceClosed: true } }), "Attendance closed")}><Lock className="h-4 w-4" />Close now</button> : <button className="btn btn-ghost w-full" disabled={!!busy} onClick={() => run("open", () => api(`/api/attendance/sessions/${id}`, { method: "PATCH", json: { reopen: true } }), "Reopened")}><LockOpen className="h-4 w-4" />Reopen</button>}
            <button className="btn btn-danger w-full" disabled={!!busy} onClick={() => confirm("Make a new QR code? Any printed codes will stop working.") && run("regen", () => api(`/api/attendance/sessions/${id}`, { method: "PATCH", json: { regenerateToken: true } }), "New QR code generated")}><RefreshCw className="h-4 w-4" />New QR code</button>
          </div>
        )}
      </div>
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">{[["Present", d.stats.total], ["Visitors", d.stats.visitors], ["Added manually", d.stats.manual]].map(([l, v]) => <div key={l as string} className="glass p-4"><p className="text-2xl font-black">{v}</p><p className="text-[11px] uppercase tracking-wider text-white/45">{l}</p></div>)}</div>
        {canManage && (
          <div className="glass p-5"><p className="mb-3 flex items-center gap-2 font-bold"><UserPlus className="h-4 w-4 text-accent" />Add someone manually</p>
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]"><input className="input" placeholder="Name" value={add.name} onChange={(e) => setAdd({ ...add, name: e.target.value })} /><input className="input" placeholder="Phone" type="tel" value={add.phone} onChange={(e) => setAdd({ ...add, phone: e.target.value })} /><input className="input" placeholder="Reason (optional)" value={add.note} onChange={(e) => setAdd({ ...add, note: e.target.value })} /><button className="btn btn-primary" disabled={!!busy} onClick={() => run("add", async () => { await api(`/api/attendance/sessions/${id}`, { method: "POST", json: add }); setAdd({ name: "", phone: "", note: "" }); }, "Added. Your name is recorded on this correction.")}>{busy === "add" && <Loader2 className="h-4 w-4 animate-spin" />}Add</button></div></div>
        )}
        <div className="glass overflow-x-auto p-0">
          <table className="w-full min-w-[520px] text-left text-sm"><thead className="text-xs uppercase tracking-wider text-white/45"><tr><th className="p-3">Name</th><th className="p-3">Parish</th><th className="p-3">Time</th><th className="p-3">How</th>{canManage && <th className="p-3" />}</tr></thead><tbody>
            {d.records.map((r: any) => (
              <tr key={r.id} className="border-t border-white/10 hover:bg-white/5"><td className="p-3"><p className="font-semibold">{r.name}{r.visitor && <span className="badge ml-2">Visitor</span>}</p><p className="text-xs text-white/40">{r.phone}</p></td><td className="p-3 text-xs text-white/55">{r.parish || "—"}</td><td className="whitespace-nowrap p-3 text-xs text-white/55">{new Date(r.at).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })}</td>
                <td className="p-3 text-xs">{r.method === "manual" ? <span className="badge badge-warn" title={r.note}>Manual · {r.addedByName}</span> : <span className="badge">QR{r.location?.provided ? (r.location.withinRadius ? " · at venue" : ` · ${r.location.distanceM} m away`) : ""}</span>}</td>
                {canManage && <td className="p-3 text-right"><button className="btn btn-danger btn-sm !p-1.5" aria-label="Remove" onClick={() => confirm(`Remove ${r.name}? This is logged.`) && run("rm" + r.id, () => api(`/api/attendance/sessions/${id}?record=${r.id}`, { method: "DELETE" }), "Removed")}><Trash2 className="h-3.5 w-3.5" /></button></td>}</tr>
            ))}
            {d.records.length === 0 && <tr><td colSpan={5} className="p-10 text-center text-white/40">Nobody yet. This list refreshes automatically.</td></tr>}
          </tbody></table>
        </div>
        <p className="text-[11px] text-white/35">A QR scan alone isn't proof of presence. Location (when shared) is shown as an extra signal, and manual corrections always show who made them.</p>
      </div>
    </div>
  );
}
