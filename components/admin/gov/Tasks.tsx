"use client";
import { Loader2, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { api } from "@/lib/fetcher";
import { TASK_STATUSES } from "@/lib/governance";
import { defaultOrg, Field, fmt, fmtDT, LevelBadge, MemberPicker, OrgPicker, orgPayload, TASK_BADGE, TASK_LABEL, today, type Me, type OrgVal } from "./shared";

export function Tasks({ me, canEdit, committee, meeting }: { me: Me; canEdit: boolean; committee?: string; meeting?: string }) {
  const toast = useToast();
  const [d, setD] = useState<any>(null);
  const [st, setSt] = useState("");
  const [over, setOver] = useState(false);
  const [add, setAdd] = useState(false);
  const [sel, setSel] = useState<any>(null);
  const load = useCallback(() => { const p = new URLSearchParams({ ...(st ? { status: st } : {}), ...(over ? { overdue: "1" } : {}), ...(committee ? { committee } : {}), ...(meeting ? { meeting } : {}) }); api(`/api/governance/tasks?${p}`).then(setD).catch((e) => { toast.err(e.message); setD({ rows: [], stats: { total: 0, open: 0, inProgress: 0, done: 0, overdue: 0, pct: 0 } }); }); }, [st, over, committee, meeting, toast]);
  useEffect(() => { load(); }, [load]);
  const s = d?.stats;
  return (
    <>
      {s && <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">{[["Total", s.total], ["To do", s.open], ["In progress", s.inProgress], ["Done", `${s.done} (${s.pct}%)`], ["Overdue", s.overdue]].map(([l, v], i) => <div key={l as string} className={cn("glass p-3", l === "Overdue" && s.overdue > 0 && "ring-1 ring-red-400/50")}><p className="text-[11px] uppercase tracking-wide text-white/65">{l}</p><p className="text-xl font-extrabold">{v}</p></div>)}</div>}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select className="input !w-auto" value={st} onChange={(e) => setSt(e.target.value)}><option value="">Any status</option>{TASK_STATUSES.map((x) => <option key={x} value={x}>{TASK_LABEL[x]}</option>)}</select>
        <label className="flex items-center gap-2 text-sm text-white/70"><input type="checkbox" checked={over} onChange={(e) => setOver(e.target.checked)} />Overdue only</label>
        {canEdit && <button className="btn btn-primary ml-auto" onClick={() => setAdd(true)}><Plus className="h-4 w-4" />New task</button>}
      </div>
      {!d && <div className="skeleton h-24" />}
      <div className="space-y-2">{d?.rows.map((t: any) => (
        <button key={t.id} onClick={() => setSel(t)} className="glass flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-left transition hover:-translate-y-0.5">
          <div className="min-w-0"><p className="truncate font-semibold">{t.title}</p><p className="truncate text-xs text-white/65">{t.assigneeName || "Unassigned"} · {t.place}{t.dueAt ? ` · due ${fmt(t.dueAt)}` : ""}</p></div>
          <div className="flex items-center gap-2">{t.priority === "high" && <span className="badge badge-bad">High</span>}{t.overdue && <span className="badge badge-bad">Overdue</span>}<LevelBadge level={t.level} /><span className={TASK_BADGE[t.status]}>{TASK_LABEL[t.status]}</span></div>
        </button>))}
        {d?.rows.length === 0 && <div className="glass p-10 text-center text-white/65">No tasks match.</div>}</div>
      {add && <AddTask me={me} committee={committee} meeting={meeting} onClose={() => setAdd(false)} onDone={() => { setAdd(false); load(); }} />}
      {sel && <TaskDetail t={sel} onClose={() => setSel(null)} onDone={() => { setSel(null); load(); }} />}
    </>
  );
}

function AddTask({ me, committee, meeting, onClose, onDone }: { me: Me; committee?: string; meeting?: string; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [parent, setParent] = useState(committee ? `c:${committee}` : "org");
  const [coms, setComs] = useState<any[]>([]);
  const [deps, setDeps] = useState<any[]>([]);
  const [org, setOrg] = useState<OrgVal>(defaultOrg(me));
  const [who, setWho] = useState<{ id: string; name: string } | null>(null);
  const [f, setF] = useState({ title: "", description: "", dueAt: "", priority: "normal" });
  const [busy, setBusy] = useState(false);
  useEffect(() => { api("/api/governance/committees?status=active").then((r) => setComs(r.rows.filter((c: any) => c.canManage))).catch(() => {}); api("/api/governance/departments").then((r) => setDeps(r.rows.filter((d: any) => d.canManage))).catch(() => {}); }, []);
  const target = parent.startsWith("c:") ? coms.find((c) => c.id === parent.slice(2)) : parent.startsWith("d:") ? deps.find((d) => d.id === parent.slice(2)) : null;
  const pickerOrg = target ? { level: target.level, zone: target.zoneId ?? "", area: target.areaId ?? "", parish: target.parishId ?? "" } : org;
  const save = async () => {
    setBusy(true);
    try {
      const link = meeting ? { meeting } : parent.startsWith("c:") ? { committee: parent.slice(2) } : parent.startsWith("d:") ? { department: parent.slice(2) } : { org: orgPayload(org) };
      await api("/api/governance/tasks", { method: "POST", json: { title: f.title, description: f.description, priority: f.priority, ...(f.dueAt ? { dueAt: f.dueAt } : {}), ...(who ? { assignee: who.id } : {}), ...link } });
      toast.ok("Task created"); onDone();
    } catch (e: any) { toast.err(e.message); }
    setBusy(false);
  };
  return (
    <Modal open onClose={onClose} title="New task" wide>
      <div className="space-y-4">
        {!meeting && <Field label="Belongs to"><select className="input" value={parent} onChange={(e) => { setParent(e.target.value); setWho(null); }}><option value="org">A level (no committee or department)</option>{coms.length > 0 && <optgroup label="Committees">{coms.map((c) => <option key={c.id} value={`c:${c.id}`}>{c.name} · {c.place}</option>)}</optgroup>}{deps.length > 0 && <optgroup label="Departments">{deps.map((d) => <option key={d.id} value={`d:${d.id}`}>{d.name} · {d.place}</option>)}</optgroup>}</select></Field>}
        {!meeting && parent === "org" && <OrgPicker me={me} value={org} onChange={(v) => { setOrg(v); setWho(null); }} />}
        <Field label="Task"><input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="What needs to be done?" /></Field>
        <Field label="Details"><textarea className="input min-h-[70px]" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        {!meeting && <MemberPicker org={pickerOrg} value={who} onChange={setWho} label="Assign to" />}
        {meeting && <p className="text-xs text-white/65">Assign to someone from the meeting's attendance list on the meeting itself.</p>}
        <div className="grid gap-3 sm:grid-cols-2"><Field label="Deadline"><input className="input" type="date" min={today()} value={f.dueAt} onChange={(e) => setF({ ...f, dueAt: e.target.value })} /></Field><Field label="Priority"><select className="input" value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option></select></Field></div>
        <button className="btn btn-primary w-full py-3" disabled={busy || f.title.trim().length < 2} onClick={save}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Create task</button>
      </div>
    </Modal>
  );
}

function TaskDetail({ t, onClose, onDone }: { t: any; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [note, setNote] = useState("");
  const [due, setDue] = useState(t.dueAt ? new Date(t.dueAt).toISOString().slice(0, 10) : "");
  const [who, setWho] = useState<{ id: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const go = async (json: any, ok: string) => { setBusy(true); try { await api(`/api/governance/tasks/${t.id}`, { method: "PATCH", json }); toast.ok(ok); onDone(); } catch (e: any) { toast.err(e.message); } setBusy(false); };
  const finished = t.status === "done" || t.status === "cancelled";
  return (
    <Modal open onClose={onClose} title={t.title} wide>
      <p className="mb-1 text-sm text-white/65">{t.place} · {t.assigneeName || "Unassigned"} · {t.dueAt ? `due ${fmt(t.dueAt)}` : "no deadline"} · <span className={TASK_BADGE[t.status]}>{TASK_LABEL[t.status]}</span>{t.overdue && <span className="badge badge-bad ml-1">Overdue</span>}</p>
      {t.description && <p className="mb-3 text-sm">{t.description}</p>}
      {t.canManage && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">{!finished && t.status === "open" && <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => go({ status: "in_progress", note }, "Started")}>Start</button>}{!finished && <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => go({ status: "done", note }, "Marked done")}>Mark done</button>}{!finished && <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => go({ status: "cancelled", note }, "Cancelled")}>Cancel task</button>}{t.status === "done" && <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => go({ status: "open", note }, "Reopened")}>Reopen</button>}</div>
          <Field label="Progress note"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional update, added to the history" /></Field>
          {!finished && <div className="grid gap-3 sm:grid-cols-2"><Field label="Deadline"><input className="input" type="date" value={due} onChange={(e) => setDue(e.target.value)} /></Field><div className="self-end"><button className="btn btn-ghost" disabled={busy} onClick={() => go({ dueAt: due }, "Deadline updated")}>Update deadline</button></div></div>}
          {!finished && <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"><MemberPicker org={{ level: t.level, zone: t.zoneId ?? "", area: t.areaId ?? "", parish: t.parishId ?? "" }} value={who} onChange={setWho} label="Reassign to" /><button className="btn btn-ghost" disabled={!who || busy} onClick={() => go({ assignee: who!.id }, "Reassigned")}>Reassign</button></div>}
        </div>
      )}
      <p className="mb-1 mt-5 text-sm font-bold">History</p>
      <ul className="space-y-1 text-xs text-white/65">{t.updates.map((u: any, i: number) => <li key={i}>{fmtDT(u.at)} · {u.byName} · {u.note || u.status}</li>)}</ul>
    </Modal>
  );
}
