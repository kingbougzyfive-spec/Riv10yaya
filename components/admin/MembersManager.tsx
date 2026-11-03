"use client";
import { Loader2, Plus, Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/fetcher";

export function MembersManager({ role }: { role: string }) {
  const toast = useToast();
  const [rows, setRows] = useState<any[] | null>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [org, setOrg] = useState<any>(null);
  const [f, setF] = useState({ name: "", phone: "", email: "", parish: "" });
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => api(`/api/members?q=${encodeURIComponent(q)}`).then((r) => setRows(r.rows)).catch((e) => { toast.err(e.message); setRows([]); }), [q, toast]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);
  useEffect(() => { if (role !== "parish_admin") api("/api/public/org").then(setOrg).catch(() => {}); }, [role]);
  async function save() {
    setBusy(true);
    try { const r = await api("/api/members", { method: "POST", json: { ...f, ...(role === "parish_admin" ? { parish: undefined } : {}) } }); toast.ok(`Added. Member ID: ${r.memberId}`); setOpen(false); setF({ name: "", phone: "", email: "", parish: "" }); load(); }
    catch (e: any) { toast.err(e.message); }
    setBusy(false);
  }
  return (
    <>
      <div className="mb-5 flex flex-wrap gap-3"><div className="relative min-w-[200px] flex-1"><Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" /><input className="input !pl-10" placeholder="Search name, phone or member ID…" value={q} onChange={(e) => setQ(e.target.value)} /></div><button className="btn btn-primary" onClick={() => setOpen(true)}><Plus className="h-4 w-4" />Add member</button></div>
      <div className="grid gap-2.5">
        {rows === null && [0, 1, 2].map((i) => <div key={i} className="skeleton h-16" />)}
        {rows?.map((m) => (
          <div key={m.id} className="glass flex flex-wrap items-center justify-between gap-3 px-4 py-3"><div className="min-w-0"><p className="truncate font-semibold">{m.name} {!m.active && <span className="badge badge-bad ml-1">Inactive</span>}</p><p className="truncate text-xs text-white/45">{m.phone} · {[m.zone, m.area, m.parish].filter(Boolean).join(" → ")}</p></div><div className="flex items-center gap-2"><span className="badge font-mono">{m.memberId}</span><button className="btn btn-ghost btn-sm" onClick={async () => { try { await api("/api/members", { method: "PATCH", json: { id: m.id, active: !m.active } }); load(); } catch (e: any) { toast.err(e.message); } }}>{m.active ? "Deactivate" : "Activate"}</button></div></div>
        ))}
        {rows?.length === 0 && <div className="glass p-10 text-center text-white/45">No members yet.</div>}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="Add member">
        <div className="space-y-4">
          <div><label className="label">Full name</label><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div><label className="label">Phone</label><input className="input" type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
          <div><label className="label">Email (optional)</label><input className="input" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
          {role !== "parish_admin" && org && <div><label className="label">Parish</label><select className="input" value={f.parish} onChange={(e) => setF({ ...f, parish: e.target.value })}><option value="">Select…</option>{org.parishes.map((p: any) => <option key={p.id} value={p.id}>{org.zones.find((z: any) => z.id === p.zone)?.name} → {p.name}</option>)}</select></div>}
          <p className="hint">A member ID is generated automatically. Members use it (or their phone) to mark attendance.</p>
          <button className="btn btn-primary w-full py-3" disabled={busy} onClick={save}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Add member</button>
        </div>
      </Modal>
    </>
  );
}
