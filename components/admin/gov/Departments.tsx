"use client";
import { Loader2, Plus } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/fetcher";
import { defaultOrg, Field, LevelBadge, OrgPicker, orgPayload, Responsibilities, type Me, type OrgVal } from "./shared";
import { LEVEL_LABEL } from "@/lib/governance";

export function Departments({ me, canEdit }: { me: Me; canEdit: boolean }) {
  const toast = useToast();
  const [rows, setRows] = useState<any[] | null>(null);
  const [add, setAdd] = useState(false);
  const [sel, setSel] = useState<any>(null);
  const load = useCallback(() => api("/api/governance/departments").then((r) => setRows(r.rows)).catch((e) => { toast.err(e.message); setRows([]); }), [toast]);
  useEffect(() => { load(); }, [load]);
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3"><p className="text-sm text-white/55">Provincial departments are shown on the public Departments page. Zone, area and parish departments are internal.</p>{canEdit && <button className="btn btn-primary ml-auto" onClick={() => setAdd(true)}><Plus className="h-4 w-4" />New department</button>}</div>
      {!rows && <div className="skeleton h-24" />}
      <div className="grid gap-3 md:grid-cols-2">
        {rows?.map((d) => (
          <button key={d.id} onClick={() => setSel(d)} className="glass p-4 text-left transition hover:-translate-y-0.5">
            <div className="flex items-start justify-between gap-2"><p className="font-bold">{d.name}</p><LevelBadge level={d.level} /></div>
            <p className="text-xs text-white/50">{d.place}</p>
            {d.description && <p className="mt-1 line-clamp-2 text-sm text-white/70">{d.description}</p>}
            <p className="mt-2 text-xs text-white/55">{d.members} member{d.members === 1 ? "" : "s"} · {d.leaders.length ? d.leaders.map((l: any) => `${l.position}: ${l.name}`).join("; ") : "No leader assigned"}</p>
          </button>
        ))}
      </div>
      {rows?.length === 0 && <div className="glass p-10 text-center text-white/50">No departments yet.</div>}
      {add && <AddDept me={me} onClose={() => setAdd(false)} onDone={() => { setAdd(false); load(); }} />}
      {sel && <Edit d={sel} onClose={() => setSel(null)} onDone={() => { setSel(null); load(); }} />}
    </>
  );
}

function AddDept({ me, onClose, onDone }: { me: Me; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [org, setOrg] = useState<OrgVal>(defaultOrg(me));
  const [f, setF] = useState({ name: "", description: "" });
  const [resp, setResp] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const save = async () => { setBusy(true); try { await api("/api/governance/departments", { method: "POST", json: { ...orgPayload(org), ...f, responsibilities: resp } }); toast.ok("Department created"); onDone(); } catch (e: any) { toast.err(e.message); } setBusy(false); };
  return (
    <Modal open onClose={onClose} title="New department" wide>
      <div className="space-y-4"><OrgPicker me={me} value={org} onChange={setOrg} /><Field label="Name"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field><Field label="What it does"><textarea className="input min-h-[80px]" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field><Responsibilities value={resp} onChange={setResp} /><button className="btn btn-primary w-full py-3" disabled={busy || f.name.trim().length < 2} onClick={save}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Create department</button></div>
    </Modal>
  );
}

function Edit({ d, onClose, onDone }: { d: any; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ name: d.name, description: d.description });
  const [resp, setResp] = useState<string[]>(d.responsibilities);
  const [busy, setBusy] = useState(false);
  const go = async (json: any, ok: string) => { setBusy(true); try { await api(`/api/governance/departments/${d.id}`, { method: "PATCH", json }); toast.ok(ok); onDone(); } catch (e: any) { toast.err(e.message); } setBusy(false); };
  return (
    <Modal open onClose={onClose} title={d.name} wide>
      <p className="mb-3 text-sm text-white/60">{LEVEL_LABEL[d.level as keyof typeof LEVEL_LABEL]} · {d.place} · {d.members} members</p>
      {d.canManage ? (
        <div className="space-y-4">
          <Field label="Name"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="What it does"><textarea className="input min-h-[80px]" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
          <Responsibilities value={resp} onChange={setResp} />
          <div className="flex flex-wrap gap-2"><button className="btn btn-primary" disabled={busy} onClick={() => go({ ...f, responsibilities: resp }, "Saved")}>Save</button><button className="btn btn-danger" disabled={busy} onClick={() => go({ active: false }, "Department archived")}>Archive</button></div>
          <p className="text-xs text-white/50">To assign a head or officers, use <b>Leadership → Assign position</b> and pick this department. To add members to it, edit the member under <Link className="text-brand underline" href="/admin/members">Members</Link>.</p>
          {d.publicSite && <p className="text-xs text-white/50">The photo and public text for provincial departments are edited under <Link className="text-brand underline" href="/admin/departments">Departments (public page)</Link>.</p>}
        </div>
      ) : <ul className="space-y-1 text-sm">{d.responsibilities.map((r: string, i: number) => <li key={i} className="rounded-lg bg-white/5 px-3 py-1.5">{r}</li>)}{!d.responsibilities.length && <li className="text-white/45">{d.description || "No details recorded."}</li>}</ul>}
    </Modal>
  );
}
