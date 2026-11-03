"use client";
import { Download, Search, UserCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/fetcher";
import { fmtDT } from "@/lib/dates";
import { cn } from "@/lib/cn";
import { TicketScanner } from "./TicketScanner";

export function RegistrationsView({ eventId, canCheckIn }: { eventId: string; canCheckIn: boolean }) {
  const toast = useToast();
  const [data, setData] = useState<any>(null);
  const [org, setOrg] = useState<any>(null);
  const [q, setQ] = useState("");
  const [zone, setZone] = useState(""); const [area, setArea] = useState(""); const [parish, setParish] = useState("");
  useEffect(() => { api("/api/public/org").then(setOrg).catch(() => {}); }, []);
  const qs = `eventId=${eventId}&q=${encodeURIComponent(q)}${zone ? `&zone=${zone}` : ""}${area ? `&area=${area}` : ""}${parish ? `&parish=${parish}` : ""}`;
  const load = useCallback(() => { api(`/api/registrations?${qs}`).then(setData).catch((e) => { toast.err(e.message); setData({ rows: [], total: 0, attended: 0 }); }); }, [qs, toast]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);
  const toggle = async (r: any) => { try { await api(`/api/registrations/${r.id}`, { method: "PATCH", json: { checkedIn: !r.checkedInAt } }); load(); } catch (e: any) { toast.err(e.message); } };

  return (
    <>
      <div className="mb-4 grid grid-cols-3 gap-3">{[["Registered", data?.total ?? "–"], ["Checked in", data?.attended ?? "–"], ["Not yet in", data ? data.total - data.attended : "–"]].map(([l, v]) => <div key={l as string} className="glass p-4"><p className="text-2xl font-black">{v}</p><p className="text-[11px] uppercase tracking-wider text-white/45">{l}</p></div>)}</div>
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative min-w-[200px] flex-1"><Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" /><input className="input !pl-10" placeholder="Search name, phone or reference…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        {org && <>
          <select className="input !w-auto" value={zone} onChange={(e) => { setZone(e.target.value); setArea(""); setParish(""); }}><option value="">All zones</option>{org.zones.map((z: any) => <option key={z.id} value={z.id}>{z.name}</option>)}</select>
          <select className="input !w-auto" value={area} onChange={(e) => { setArea(e.target.value); setParish(""); }}><option value="">All areas</option>{org.areas.filter((a: any) => !zone || a.zone === zone).map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
          <select className="input !w-auto" value={parish} onChange={(e) => setParish(e.target.value)}><option value="">All parishes</option>{org.parishes.filter((p: any) => (!zone || p.zone === zone) && (!area || p.area === area)).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        </>}
        {canCheckIn && <TicketScanner eventId={eventId} onChecked={load} />}
        <a className="btn btn-ghost" href={`/api/registrations?${qs}&format=xlsx`}><Download className="h-4 w-4" />Excel</a>
        <a className="btn btn-ghost" href={`/api/registrations?${qs}&format=pdf`}><Download className="h-4 w-4" />PDF</a>
      </div>
      <div className="glass overflow-x-auto p-0">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wider text-white/45"><tr><th className="p-3">Name</th><th className="p-3">Reference</th><th className="p-3">Parish</th><th className="p-3">Registered</th><th className="p-3">Status</th></tr></thead>
          <tbody>
            {data === null && <tr><td colSpan={5} className="p-6"><div className="skeleton h-10" /></td></tr>}
            {data?.rows.map((r: any) => (
              <tr key={r.id} className="border-t border-white/10 hover:bg-white/5">
                <td className="p-3"><p className="font-semibold">{r.name}</p><a className="text-xs text-brand" href={`tel:${r.phone}`}>{r.phone}</a></td>
                <td className="p-3 font-mono text-xs text-accent">{r.reference}</td>
                <td className="p-3 text-xs text-white/55">{[r.zone, r.area, r.parish].filter(Boolean).join(" → ") || "—"}</td>
                <td className="whitespace-nowrap p-3 text-xs text-white/45">{fmtDT(r.createdAt)}</td>
                <td className="p-3">{canCheckIn ? <button onClick={() => toggle(r)} className={cn("btn btn-sm", r.checkedInAt ? "btn-primary" : "btn-ghost")}><UserCheck className="h-3.5 w-3.5" />{r.checkedInAt ? "Checked in" : "Check in"}</button> : <span className={cn("badge", r.checkedInAt ? "badge-ok" : "")}>{r.checkedInAt ? "Attended" : "Registered"}</span>}</td>
              </tr>
            ))}
            {data?.rows.length === 0 && <tr><td colSpan={5} className="p-10 text-center text-white/40">No registrations match.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
