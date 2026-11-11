"use client";
import { Loader2, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/fetcher";
import { COMMITTEE_ROLES, COMMITTEE_ROLE_LABEL, LEVEL_LABEL, LEVELS, type GLevel } from "@/lib/governance";
import { defaultOrg, Field, fmt, fmtDT, LevelBadge, MemberPicker, OrgPicker, orgPayload, Responsibilities, TASK_BADGE, TASK_LABEL, type Me, type OrgVal } from "./shared";

export function Committees({ me, canEdit, onOpenTask }: { me: Me; canEdit: boolean; onOpenTask?: () => void }) {
  const toast = useToast();
  const [rows, setRows] = useState<any[] | null>(null);
  const [lv, setLv] = useState("");
  const [add, setAdd] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const load = useCallback(() => { setRows(null); api(`/api/governance/committees${lv ? `?level=${lv}` : ""}`).then((r) => setRows(r.rows)).catch((e) => { toast.err(e.message); setRows([]); }); }, [lv, toast]);
  useEffect(() => { load(); }, [load]);
  void onOpenTask;
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2"><select className="input !w-auto" value={lv} onChange={(e) => setLv(e.target.value)}><option value="">All levels</option>{LEVELS.map((l) => <option key={l} value={l}>{LEVEL_LABEL[l]}</option>)}</select>{canEdit && <button className="btn btn-primary ml-auto" onClick={() => setAdd(true)}><Plus className="h-4 w-4" />New committee</button>}</div>
      {!rows && <div className="skeleton h-24" />}
      <div className="grid gap-3 md:grid-cols-2">{rows?.map((c) => (
        <button key={c.id} onClick={() => setOpen(c.id)} className="glass p-4 text-left transition hover:-translate-y-0.5">
          <div className="flex items-start justify-between gap-2"><p className="font-bold">{c.name}</p><div className="flex gap-1">{c.status === "dissolved" && <span className="badge badge-bad">Dissolved</span>}<LevelBadge level={c.level} /></div></div>
          <p className="text-xs text-white/65">{c.place}</p>
          {c.purpose && <p className="mt-1 line-clamp-2 text-sm text-white/70">{c.purpose}</p>}
          <p className="mt-2 text-xs text-white/65">{c.members} member{c.members === 1 ? "" : "s"}{c.chair ? ` · Chair: ${c.chair}` : ""}</p>
        </button>))}</div>
      {rows?.length === 0 && <div className="glass p-10 text-center text-white/65">No committees yet.</div>}
      {add && <AddCommittee me={me} onClose={() => setAdd(false)} onDone={(id) => { setAdd(false); load(); setOpen(id); }} />}
      {open && <Detail id={open} onClose={() => { setOpen(null); load(); }} />}
    </>
  );
}

function AddCommittee({ me, onClose, onDone }: { me: Me; onClose: () => void; onDone: (id: string) => void }) {
  const toast = useToast();
  const [org, setOrg] = useState<OrgVal>(defaultOrg(me));
  const [f, setF] = useState({ name: "", purpose: "" });
  const [resp, setResp] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const save = async () => { setBusy(true); try { const r = await api("/api/governance/committees", { method: "POST", json: { ...orgPayload(org), ...f, responsibilities: resp } }); toast.ok("Committee created"); onDone(r.id); } catch (e: any) { toast.err(e.message); } setBusy(false); };
  return (
    <Modal open onClose={onClose} title="New committee" wide>
      <div className="space-y-4"><OrgPicker me={me} value={org} onChange={setOrg} /><Field label="Committee name"><input className="input" placeholder="e.g. Gratitude Planning Committee" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field><Field label="Purpose"><textarea className="input min-h-[80px]" value={f.purpose} onChange={(e) => setF({ ...f, purpose: e.target.value })} /></Field><Responsibilities value={resp} onChange={setResp} /><button className="btn btn-primary w-full py-3" disabled={busy || f.name.trim().length < 2} onClick={save}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Create committee</button></div>
    </Modal>
  );
}

function Detail({ id, onClose }: { id: string; onClose: () => void }) {
  const toast = useToast();
  const [d, setD] = useState<any>(null);
  const [who, setWho] = useState<{ id: string; name: string } | null>(null);
  const [role, setRole] = useState("member");
  const [resp, setResp] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const load = useCallback(() => api(`/api/governance/committees/${id}`).then((r) => { setD(r); setResp(r.committee.responsibilities); }).catch((e) => { toast.err(e.message); onClose(); }), [id, toast, onClose]);
  useEffect(() => { load(); }, [load]);
  const go = async (json: any, ok: string) => { setBusy(true); try { await api(`/api/governance/committees/${id}`, { method: "PATCH", json }); toast.ok(ok); setWho(null); load(); } catch (e: any) { toast.err(e.message); } setBusy(false); };
  const c = d?.committee;
  const editable = c?.canManage && c?.status === "active";
  return (
    <Modal open onClose={onClose} title={c?.name ?? "Committee"} wide>
      {!c && <div className="grid place-items-center py-12"><Loader2 className="h-5 w-5 animate-spin text-brand" /></div>}
      {c && (
        <div className="space-y-6">
          <p className="text-sm text-white/65">{LEVEL_LABEL[c.level as GLevel]} · {c.place} · formed {fmt(c.formedAt)}{c.status === "dissolved" ? ` · dissolved ${fmt(c.dissolvedAt)}` : ""}</p>
          {c.purpose && <p className="text-sm">{c.purpose}</p>}
          <section>
            <p className="mb-2 font-bold">Members</p>
            <ul className="space-y-1.5 text-sm">{c.members.filter((m: any) => m.active).map((m: any) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/5 px-3 py-2"><span>{m.name}</span>
                <span className="flex items-center gap-2">{editable ? <select className="input !w-auto !py-1 text-xs" value={m.role} onChange={(e) => go({ action: "set_role", rowId: m.id, role: e.target.value }, "Role updated")}>{COMMITTEE_ROLES.map((r) => <option key={r} value={r}>{COMMITTEE_ROLE_LABEL[r]}</option>)}</select> : <span className="badge">{COMMITTEE_ROLE_LABEL[m.role]}</span>}{editable && <button className="text-xs text-white/65 hover:text-red-300" onClick={() => go({ action: "remove_member", rowId: m.id }, "Removed")}>Remove</button>}</span></li>))}
              {!c.members.some((m: any) => m.active) && <li className="text-white/65">No members yet.</li>}</ul>
            {editable && <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_180px_auto] sm:items-end"><MemberPicker org={{ level: c.level, zone: c.zoneId ?? "", area: c.areaId ?? "", parish: c.parishId ?? "" }} value={who} onChange={setWho} label="Add a member" /><Field label="Role"><select className="input" value={role} onChange={(e) => setRole(e.target.value)}>{COMMITTEE_ROLES.map((r) => <option key={r} value={r}>{COMMITTEE_ROLE_LABEL[r]}</option>)}</select></Field><button className="btn btn-primary" disabled={!who || busy} onClick={() => go({ action: "add_member", member: who!.id, role }, "Member added")}>Add</button></div>}
          </section>
          {editable && <section><Responsibilities value={resp} onChange={setResp} /><button className="btn btn-ghost btn-sm mt-2" disabled={busy} onClick={() => go({ action: "update", responsibilities: resp }, "Saved")}>Save responsibilities</button></section>}
          {!editable && c.responsibilities.length > 0 && <section><p className="mb-1 font-bold">Responsibilities</p><ul className="space-y-1 text-sm">{c.responsibilities.map((r: string, i: number) => <li key={i} className="rounded-lg bg-white/5 px-3 py-1.5">{r}</li>)}</ul></section>}
          <section>
            <p className="mb-2 font-bold">Tasks <span className="text-xs font-normal text-white/65">{d.taskStats.done}/{d.taskStats.total} done{d.taskStats.overdue ? ` · ${d.taskStats.overdue} overdue` : ""}</span></p>
            <ul className="space-y-1 text-sm">{d.tasks.map((t: any) => <li key={t.id} className="flex justify-between gap-2 rounded-lg bg-white/5 px-3 py-1.5"><span>{t.title}<span className="text-xs text-white/65"> · {t.assigneeName || "Unassigned"}{t.dueAt ? ` · due ${fmt(t.dueAt)}` : ""}</span></span><span className={TASK_BADGE[t.status]}>{TASK_LABEL[t.status]}</span></li>)}{!d.tasks.length && <li className="text-white/65">No tasks. Add them from the Tasks tab.</li>}</ul>
          </section>
          <section><p className="mb-2 font-bold">Meetings</p><ul className="space-y-1 text-sm">{d.meetings.map((m: any) => <li key={m.id} className="flex justify-between rounded-lg bg-white/5 px-3 py-1.5"><span>{m.title}</span><span className="text-xs text-white/65">{fmtDT(m.scheduledAt)} · {m.status}</span></li>)}{!d.meetings.length && <li className="text-white/65">None yet. Schedule one from the Meetings tab.</li>}</ul></section>
          {d.documents.length > 0 && <section><p className="mb-2 font-bold">Documents</p><ul className="space-y-1 text-sm">{d.documents.map((x: any) => <li key={x.id}><a className="flex justify-between rounded-lg bg-white/5 px-3 py-1.5 hover:bg-white/10" href={`/api/media/${x.mediaId}`} target="_blank" rel="noreferrer"><span>{x.title}</span><span className="text-xs text-white/65">{x.category}</span></a></li>)}</ul></section>}
          {editable && <section className="border-t border-white/10 pt-4"><Field label="Dissolve this committee" hint="Its records and history stay."><input className="input" placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} /></Field><button className="btn btn-danger mt-2" disabled={busy || reason.length < 2} onClick={() => go({ action: "dissolve", reason }, "Committee dissolved")}>Dissolve</button></section>}
          <section><p className="mb-1 text-sm font-bold">History</p><ul className="space-y-1 text-xs text-white/65">{c.history.map((h: any, i: number) => <li key={i}>{fmt(h.at)} · {h.byName} · {h.action}{h.note ? `: ${h.note}` : ""}</li>)}</ul></section>
        </div>
      )}
    </Modal>
  );
}
