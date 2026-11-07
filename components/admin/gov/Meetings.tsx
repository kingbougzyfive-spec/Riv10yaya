"use client";
import { Loader2, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/fetcher";
import { LEVEL_LABEL, type GLevel } from "@/lib/governance";
import { defaultOrg, Field, fmt, fmtDT, LevelBadge, MemberPicker, OrgPicker, orgPayload, TASK_BADGE, TASK_LABEL, today, type Me, type OrgVal } from "./shared";

const ST: Record<string, string> = { scheduled: "badge badge-warn", held: "badge badge-ok", cancelled: "badge badge-bad" };

export function Meetings({ me, canEdit }: { me: Me; canEdit: boolean }) {
  const toast = useToast();
  const [rows, setRows] = useState<any[] | null>(null);
  const [add, setAdd] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const load = useCallback(() => api("/api/governance/meetings").then((r) => setRows(r.rows)).catch((e) => { toast.err(e.message); setRows([]); }), [toast]);
  useEffect(() => { load(); }, [load]);
  return (
    <>
      <div className="mb-4 flex">{canEdit && <button className="btn btn-primary ml-auto" onClick={() => setAdd(true)}><Plus className="h-4 w-4" />Schedule meeting</button>}</div>
      {!rows && <div className="skeleton h-24" />}
      <div className="space-y-2">{rows?.map((m) => (
        <button key={m.id} onClick={() => setOpen(m.id)} className="glass flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-left transition hover:-translate-y-0.5">
          <div className="min-w-0"><p className="truncate font-semibold">{m.title}</p><p className="truncate text-xs text-white/50">{fmtDT(m.scheduledAt)} · {m.place}{m.venue ? ` · ${m.venue}` : ""}</p></div>
          <div className="flex items-center gap-2">{m.attendance.total > 0 && m.status === "held" && <span className="badge">{m.attendance.present}/{m.attendance.total} present</span>}{m.hasMinutes && <span className="badge badge-ok">Minutes</span>}<LevelBadge level={m.level} /><span className={ST[m.status]}>{m.status}</span></div>
        </button>))}
        {rows?.length === 0 && <div className="glass p-10 text-center text-white/50">No meetings yet.</div>}</div>
      {add && <AddMeeting me={me} onClose={() => setAdd(false)} onDone={(id) => { setAdd(false); load(); setOpen(id); }} />}
      {open && <Detail id={open} canEdit={canEdit} onClose={() => { setOpen(null); load(); }} />}
    </>
  );
}

function AddMeeting({ me, onClose, onDone }: { me: Me; onClose: () => void; onDone: (id: string) => void }) {
  const toast = useToast();
  const [parent, setParent] = useState("org");
  const [coms, setComs] = useState<any[]>([]);
  const [deps, setDeps] = useState<any[]>([]);
  const [org, setOrg] = useState<OrgVal>(defaultOrg(me));
  const [f, setF] = useState({ title: "", date: "", time: "17:00", venue: "", agenda: "", kind: "leadership" });
  const [busy, setBusy] = useState(false);
  useEffect(() => { api("/api/governance/committees?status=active").then((r) => setComs(r.rows.filter((c: any) => c.canManage))).catch(() => {}); api("/api/governance/departments").then((r) => setDeps(r.rows.filter((d: any) => d.canManage))).catch(() => {}); }, []);
  const save = async () => {
    setBusy(true);
    try {
      const link = parent.startsWith("c:") ? { committee: parent.slice(2) } : parent.startsWith("d:") ? { department: parent.slice(2) } : { org: orgPayload(org), bodyKind: f.kind };
      const r = await api("/api/governance/meetings", { method: "POST", json: { title: f.title, scheduledAt: new Date(`${f.date}T${f.time}`).toISOString(), venue: f.venue, agenda: f.agenda, ...link } });
      toast.ok("Meeting scheduled"); onDone(r.id);
    } catch (e: any) { toast.err(e.message); }
    setBusy(false);
  };
  return (
    <Modal open onClose={onClose} title="Schedule a meeting" wide>
      <div className="space-y-4">
        <Field label="Meeting of"><select className="input" value={parent} onChange={(e) => setParent(e.target.value)}><option value="org">Leadership / other (choose a level)</option>{coms.length > 0 && <optgroup label="Committees">{coms.map((c) => <option key={c.id} value={`c:${c.id}`}>{c.name} · {c.place}</option>)}</optgroup>}{deps.length > 0 && <optgroup label="Departments">{deps.map((d) => <option key={d.id} value={`d:${d.id}`}>{d.name} · {d.place}</option>)}</optgroup>}</select></Field>
        {parent === "org" && <><OrgPicker me={me} value={org} onChange={setOrg} /><Field label="Kind"><select className="input" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}><option value="leadership">Leadership meeting</option><option value="other">Other</option></select></Field></>}
        <Field label="Title"><input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <div className="grid gap-3 sm:grid-cols-3"><Field label="Date"><input className="input" type="date" min={today()} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field><Field label="Time"><input className="input" type="time" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} /></Field><Field label="Venue"><input className="input" value={f.venue} onChange={(e) => setF({ ...f, venue: e.target.value })} /></Field></div>
        <Field label="Agenda"><textarea className="input min-h-[80px]" value={f.agenda} onChange={(e) => setF({ ...f, agenda: e.target.value })} /></Field>
        <button className="btn btn-primary w-full py-3" disabled={busy || f.title.trim().length < 2 || !f.date} onClick={save}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Schedule</button>
      </div>
    </Modal>
  );
}

const TABS = ["Overview", "Attendance", "Minutes", "Decisions & actions", "Documents"] as const;

function Detail({ id, canEdit, onClose }: { id: string; canEdit: boolean; onClose: () => void }) {
  const toast = useToast();
  const [d, setD] = useState<any>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview");
  const [att, setAtt] = useState<Record<string, string>>({});
  const [minutes, setMinutes] = useState("");
  const [dec, setDec] = useState("");
  const [act, setAct] = useState({ text: "", dueAt: "" });
  const [who, setWho] = useState<{ id: string; name: string } | null>(null);
  const [extra, setExtra] = useState<{ id: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => api(`/api/governance/meetings/${id}`).then((r) => { setD(r); setMinutes(r.meeting.minutes ?? ""); setAtt(Object.fromEntries(r.attendance.map((a: any) => [a.id, a.status]))); }).catch((e) => { toast.err(e.message); onClose(); }), [id, toast, onClose]);
  useEffect(() => { load(); }, [load]);
  const go = async (json: any, ok: string) => { setBusy(true); try { await api(`/api/governance/meetings/${id}`, { method: "PATCH", json }); toast.ok(ok); load(); return true; } catch (e: any) { toast.err(e.message); return false; } finally { setBusy(false); } };
  const m = d?.meeting;
  const edit = canEdit && m?.canManage && m?.status !== "cancelled";
  const started = m && new Date(m.scheduledAt) <= new Date();
  const org = m ? { level: m.level as GLevel, zone: m.zoneId ?? "", area: m.areaId ?? "", parish: m.parishId ?? "" } : { level: "province" as GLevel };
  return (
    <Modal open onClose={onClose} title={m?.title ?? "Meeting"} wide>
      {!m && <div className="grid place-items-center py-12"><Loader2 className="h-5 w-5 animate-spin text-brand" /></div>}
      {m && (
        <>
          <div className="mb-4 flex flex-wrap gap-1.5">{TABS.map((t) => <button key={t} onClick={() => setTab(t)} className={`rounded-xl px-3.5 py-1.5 text-sm font-semibold ${tab === t ? "bg-brand text-[#04130d]" : "bg-white/5 text-white/65"}`}>{t}</button>)}</div>
          {tab === "Overview" && (
            <div className="space-y-3 text-sm">
              <p>{fmtDT(m.scheduledAt)}{m.venue ? ` · ${m.venue}` : ""} · {LEVEL_LABEL[m.level as GLevel]} · {m.place} · <span className={ST[m.status]}>{m.status}</span></p>
              {m.agenda && <div><p className="mb-1 font-bold">Agenda</p><p className="whitespace-pre-wrap text-white/75">{m.agenda}</p></div>}
              <p className="text-white/60">Attendance: {m.attendance.present} present, {m.attendance.apology} apologies, {m.attendance.absent} absent of {m.attendance.total}</p>
              {edit && m.status === "scheduled" && <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => go({ action: "cancel" }, "Meeting cancelled")}>Cancel meeting</button>}
            </div>
          )}
          {tab === "Attendance" && (
            <div className="space-y-3">
              {!started && <p className="text-sm text-white/55">Attendance opens when the meeting starts ({fmtDT(m.scheduledAt)}).</p>}
              <ul className="space-y-1.5 text-sm">{d.attendance.map((a: any) => <li key={a.id} className="flex items-center justify-between gap-2 rounded-lg bg-white/5 px-3 py-2"><span>{a.name}</span>{edit && started ? <select className="input !w-auto !py-1 text-xs" value={att[a.id]} onChange={(e) => setAtt({ ...att, [a.id]: e.target.value })}><option value="present">Present</option><option value="apology">Apology</option><option value="absent">Absent</option></select> : <span className="badge capitalize">{a.status}</span>}</li>)}{!d.attendance.length && <li className="text-white/45">No one on the list yet.</li>}</ul>
              {edit && started && <><button className="btn btn-primary btn-sm" disabled={busy || !d.attendance.length} onClick={() => go({ action: "attendance", rows: Object.entries(att).map(([id, status]) => ({ id, status })) }, "Attendance saved")}>Save attendance</button>
                <div className="grid gap-3 border-t border-white/10 pt-3 sm:grid-cols-[1fr_auto] sm:items-end"><MemberPicker org={org} value={extra} onChange={setExtra} label="Add someone not on the list" /><button className="btn btn-ghost" disabled={!extra || busy} onClick={async () => { if (await go({ action: "add_attendee", member: extra!.id }, "Added")) setExtra(null); }}>Add as present</button></div></>}
            </div>
          )}
          {tab === "Minutes" && (
            <div className="space-y-3">
              {m.minutesAt && <p className="text-xs text-white/50">Recorded by {m.minutesBy} on {fmtDT(m.minutesAt)}. Saving again replaces the text.</p>}
              {edit ? (started ? <><textarea className="input min-h-[240px]" value={minutes} onChange={(e) => setMinutes(e.target.value)} placeholder="Opening prayer, attendance, discussion, resolutions, closing…" /><button className="btn btn-primary" disabled={busy || minutes.trim().length < 5} onClick={() => go({ action: "minutes", minutes }, "Minutes saved")}>Save minutes</button></> : <p className="text-sm text-white/55">Minutes can be written once the meeting has started.</p>) : <p className="whitespace-pre-wrap text-sm">{m.minutes || "No minutes recorded."}</p>}
            </div>
          )}
          {tab === "Decisions & actions" && (
            <div className="space-y-5">
              <section><p className="mb-2 font-bold">Decisions</p><ul className="space-y-1.5 text-sm">{d.decisions.map((x: any) => <li key={x.id} className="rounded-lg bg-white/5 px-3 py-2">{x.text}<span className="block text-xs text-white/45">{x.byName} · {fmt(x.at)}</span></li>)}{!d.decisions.length && <li className="text-white/45">None recorded.</li>}</ul>
                {edit && <div className="mt-2 flex gap-2"><input className="input" placeholder="Record a decision" value={dec} onChange={(e) => setDec(e.target.value)} /><button className="btn btn-ghost" disabled={busy || dec.trim().length < 3} onClick={async () => { if (await go({ action: "decision_add", text: dec }, "Decision recorded")) setDec(""); }}>Add</button></div>}</section>
              <section><p className="mb-2 font-bold">Action points</p><ul className="space-y-1.5 text-sm">{d.tasks.map((t: any) => <li key={t.id} className="flex items-center justify-between gap-2 rounded-lg bg-white/5 px-3 py-2"><span>{t.title}<span className="text-xs text-white/45"> · {t.assigneeName || "Unassigned"}{t.dueAt ? ` · due ${fmt(t.dueAt)}` : ""}</span></span><span className={TASK_BADGE[t.status]}>{TASK_LABEL[t.status]}</span></li>)}{!d.tasks.length && <li className="text-white/45">None recorded.</li>}</ul>
                {edit && <div className="mt-3 space-y-3 rounded-xl border border-white/10 p-3"><Field label="New action point (becomes a tracked task)"><input className="input" value={act.text} onChange={(e) => setAct({ ...act, text: e.target.value })} /></Field><div className="grid gap-3 sm:grid-cols-2"><MemberPicker org={org} value={who} onChange={setWho} label="Owner" /><Field label="Deadline"><input className="input" type="date" min={today()} value={act.dueAt} onChange={(e) => setAct({ ...act, dueAt: e.target.value })} /></Field></div><button className="btn btn-primary btn-sm" disabled={busy || act.text.trim().length < 3} onClick={async () => { if (await go({ action: "action_add", text: act.text, ...(who ? { assignee: who.id } : {}), ...(act.dueAt ? { dueAt: act.dueAt } : {}) }, "Action point added")) { setAct({ text: "", dueAt: "" }); setWho(null); } }}>Add action point</button></div>}</section>
            </div>
          )}
          {tab === "Documents" && <ul className="space-y-1.5 text-sm">{d.documents.map((x: any) => <li key={x.id}><a className="flex justify-between rounded-lg bg-white/5 px-3 py-2 hover:bg-white/10" href={`/api/media/${x.mediaId}`} target="_blank" rel="noreferrer"><span>{x.title}</span><span className="text-xs text-white/45">{x.category}</span></a></li>)}{!d.documents.length && <li className="text-white/45">No documents attached. Upload one from the Documents tab and choose this meeting.</li>}</ul>}
        </>
      )}
    </Modal>
  );
}
