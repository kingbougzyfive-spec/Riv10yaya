"use client";
import { Loader2, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/fetcher";
import { LEVELS, LEVEL_LABEL, POSITIONS, type GLevel } from "@/lib/governance";
import { defaultOrg, Field, fmt, LevelBadge, MemberPicker, OrgPicker, orgPayload, Responsibilities, type Me, type OrgVal } from "./shared";

export function Leadership({ me, canEdit }: { me: Me; canEdit: boolean }) {
  const toast = useToast();
  const [rows, setRows] = useState<any[] | null>(null);
  const [lv, setLv] = useState("");
  const [show, setShow] = useState("active");
  const [add, setAdd] = useState(false);
  const [sel, setSel] = useState<any>(null);
  const load = useCallback(() => { setRows(null); api(`/api/governance/appointments?${new URLSearchParams({ ...(lv ? { level: lv } : {}), ...(show ? { status: show } : {}) })}`).then((r) => setRows(r.rows)).catch((e) => { toast.err(e.message); setRows([]); }); }, [lv, show, toast]);
  useEffect(() => { load(); }, [load]);
  const groups = LEVELS.map((l) => ({ l, items: (rows ?? []).filter((r) => r.level === l) })).filter((g) => g.items.length);
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select className="input !w-auto" value={lv} onChange={(e) => setLv(e.target.value)}><option value="">All levels</option>{LEVELS.map((l) => <option key={l} value={l}>{LEVEL_LABEL[l]}</option>)}</select>
        <select className="input !w-auto" value={show} onChange={(e) => setShow(e.target.value)}><option value="active">Current</option><option value="ended">Past</option><option value="">All</option></select>
        {canEdit && <button className="btn btn-primary ml-auto" onClick={() => setAdd(true)}><Plus className="h-4 w-4" />Assign position</button>}
      </div>
      {!rows && <div className="skeleton h-24" />}
      {groups.map((g) => (
        <section key={g.l} className="mb-6">
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-white/55">{LEVEL_LABEL[g.l]} leadership</h3>
          <div className="grid gap-2.5 md:grid-cols-2">{g.items.map((a) => (
            <button key={a.id} onClick={() => setSel(a)} className="glass p-4 text-left transition hover:-translate-y-0.5">
              <div className="flex items-start justify-between gap-2"><div><p className="font-bold">{a.position}</p><p className="text-sm text-white/80">{a.holderName}</p></div>{a.status === "ended" ? <span className="badge">Ended</span> : <LevelBadge level={a.level} />}</div>
              <p className="mt-1 text-xs text-white/50">{a.place} · since {fmt(a.startsAt)}</p>
              {a.responsibilities.length > 0 && <p className="mt-2 line-clamp-2 text-xs text-white/60">{a.responsibilities.join(" · ")}</p>}
            </button>))}</div>
        </section>
      ))}
      {rows && !groups.length && <div className="glass p-10 text-center text-white/50">No leadership appointments yet.</div>}
      {add && <AddAppointment me={me} onClose={() => setAdd(false)} onDone={() => { setAdd(false); load(); }} />}
      {sel && <Manage a={sel} onClose={() => setSel(null)} onDone={() => { setSel(null); load(); }} />}
    </>
  );
}

function AddAppointment({ me, onClose, onDone }: { me: Me; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [org, setOrg] = useState<OrgVal>(defaultOrg(me));
  const [pos, setPos] = useState("");
  const [who, setWho] = useState<{ id: string; name: string } | null>(null);
  const [other, setOther] = useState("");
  const [resp, setResp] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const save = async () => { setBusy(true); try { await api("/api/governance/appointments", { method: "POST", json: { ...orgPayload(org), position: pos, responsibilities: resp, ...(who ? { member: who.id } : { holderName: other }) } }); toast.ok("Position assigned"); onDone(); } catch (e: any) { toast.err(e.message); } setBusy(false); };
  return (
    <Modal open onClose={onClose} title="Assign leadership position" wide>
      <div className="space-y-4">
        <OrgPicker me={me} value={org} onChange={(v) => { setOrg(v); setWho(null); }} />
        <Field label="Position"><input className="input" list="positions" value={pos} onChange={(e) => setPos(e.target.value)} placeholder="Choose or type a title" /><datalist id="positions">{POSITIONS[org.level as GLevel].map((p) => <option key={p} value={p} />)}</datalist></Field>
        <MemberPicker org={org} value={who} onChange={setWho} label="Holder (a member of this level)" />
        {!who && <Field label="…or a person not in the member list" hint="Use this only for someone who isn't registered as a member."><input className="input" value={other} onChange={(e) => setOther(e.target.value)} /></Field>}
        <Responsibilities value={resp} onChange={setResp} />
        <button className="btn btn-primary w-full py-3" disabled={busy || pos.trim().length < 2 || (!who && other.trim().length < 2)} onClick={save}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Assign</button>
      </div>
    </Modal>
  );
}

function Manage({ a, onClose, onDone }: { a: any; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [pos, setPos] = useState(a.position);
  const [resp, setResp] = useState<string[]>(a.responsibilities);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const go = async (json: any, ok: string) => { setBusy(true); try { await api(`/api/governance/appointments/${a.id}`, { method: "PATCH", json }); toast.ok(ok); onDone(); } catch (e: any) { toast.err(e.message); } setBusy(false); };
  const edit = a.canManage && a.status === "active";
  return (
    <Modal open onClose={onClose} title={`${a.position} · ${a.holderName}`} wide>
      <p className="mb-3 text-sm text-white/60">{a.place} · {LEVEL_LABEL[a.level as GLevel]} · since {fmt(a.startsAt)}{a.status === "ended" ? ` · ended ${fmt(a.endedAt)}: ${a.endedReason}` : ""}</p>
      {edit ? <div className="space-y-4"><Field label="Position title"><input className="input" value={pos} onChange={(e) => setPos(e.target.value)} /></Field><Responsibilities value={resp} onChange={setResp} /><button className="btn btn-primary" disabled={busy} onClick={() => go({ action: "update", position: pos, responsibilities: resp }, "Saved")}>Save</button>
        <div className="border-t border-white/10 pt-4"><Field label="End this appointment" hint="The record stays in the history."><input className="input" placeholder="Reason (e.g. term completed)" value={reason} onChange={(e) => setReason(e.target.value)} /></Field><button className="btn btn-danger mt-2" disabled={busy || reason.length < 2} onClick={() => go({ action: "end", reason }, "Appointment ended")}>End appointment</button></div></div>
        : <ul className="space-y-1 text-sm">{a.responsibilities.map((r: string, i: number) => <li key={i} className="rounded-lg bg-white/5 px-3 py-1.5">{r}</li>)}{!a.responsibilities.length && <li className="text-white/45">No responsibilities recorded.</li>}</ul>}
      <p className="mb-1 mt-5 text-sm font-bold">History</p>
      <ul className="space-y-1 text-xs text-white/60">{a.history.map((h: any, i: number) => <li key={i}>{fmt(h.at)} · {h.byName} · {h.action}{h.note ? `: ${h.note}` : ""}</li>)}</ul>
    </Modal>
  );
}
