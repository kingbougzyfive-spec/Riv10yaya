"use client";
import { Download, Loader2, Lock, Plus, Search, Settings2, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { api } from "@/lib/fetcher";
import { MEMBER_STATUSES, STATUS_LABEL } from "@/lib/members";

const today = () => new Date().toISOString().slice(0, 10);
const day = (v?: string) => (v ? new Date(v).toISOString().slice(0, 10) : "");
const fmt = (v?: string) => (v ? new Date(v).toLocaleDateString("en-NG", { dateStyle: "medium" }) : "—");
const STATUS_BADGE: Record<string, string> = { active: "badge badge-ok", inactive: "badge badge-bad", visitor: "badge badge-warn", transferred: "badge" };

export function MembersManager({ role }: { role: string }) {
  const toast = useToast();
  const [d, setD] = useState<any>(null);
  const [org, setOrg] = useState<any>(null);
  const [depts, setDepts] = useState<any[]>([]);
  const [fl, setFl] = useState({ q: "", zone: "", area: "", parish: "", category: "", status: "", minor: "", department: "", leaders: "", page: 1 });
  const [add, setAdd] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [cats, setCats] = useState(false);
  const scoped = role === "parish_admin";
  const qs = useMemo(() => new URLSearchParams(Object.entries(fl).filter(([k, v]) => v !== "" && !(k === "page" && v === 1)).map(([k, v]) => [k, String(v)])).toString(), [fl]);
  const load = useCallback(() => api(`/api/members?${qs}`).then(setD).catch((e) => { toast.err(e.message); setD({ rows: [], total: 0, pages: 1, categories: [] }); }), [qs, toast]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);
  useEffect(() => { api("/api/public/org").then(setOrg).catch(() => {}); api("/api/governance/departments").then((r) => setDepts(r.rows)).catch(() => {}); }, []);
  const set = (p: Partial<typeof fl>) => setFl((x) => ({ ...x, page: 1, ...p }));
  const areas = (org?.areas ?? []).filter((a: any) => !fl.zone || a.zone === fl.zone);
  const parishes = (org?.parishes ?? []).filter((p: any) => (!fl.zone || p.zone === fl.zone) && (!fl.area || p.area === fl.area));

  return (
    <>
      <div className="glass mb-4 space-y-3 p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative min-w-[220px] flex-1"><Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" /><input className="input !pl-10" placeholder="Search name, phone, email or member ID…" value={fl.q} onChange={(e) => set({ q: e.target.value })} /></div>
          <button className="btn btn-primary" onClick={() => setAdd(true)}><Plus className="h-4 w-4" />Add member</button>
          {["super_admin", "provincial_admin"].includes(role) && <button className="btn btn-ghost" onClick={() => setCats(true)}><Settings2 className="h-4 w-4" />Categories</button>}
        </div>
        <div className="flex flex-wrap gap-2">
          {!scoped && <>
            <select className="input !w-auto" aria-label="Zone" value={fl.zone} onChange={(e) => set({ zone: e.target.value, area: "", parish: "" })}><option value="">All zones</option>{(org?.zones ?? []).map((z: any) => <option key={z.id} value={z.id}>{z.name}</option>)}</select>
            <select className="input !w-auto" aria-label="Area" value={fl.area} onChange={(e) => set({ area: e.target.value, parish: "" })}><option value="">All areas</option>{areas.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
            <select className="input !w-auto" aria-label="Parish" value={fl.parish} onChange={(e) => set({ parish: e.target.value })}><option value="">All parishes</option>{parishes.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          </>}
          <select className="input !w-auto" aria-label="Category" value={fl.category} onChange={(e) => set({ category: e.target.value })}><option value="">All categories</option>{(d?.categories ?? []).map((c: any) => <option key={c.key}>{c.label}</option>)}</select>
          <select className="input !w-auto" aria-label="Status" value={fl.status} onChange={(e) => set({ status: e.target.value })}><option value="">Any status</option>{MEMBER_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select>
          <select className="input !w-auto" aria-label="Department" value={fl.department} onChange={(e) => set({ department: e.target.value })}><option value="">Any department</option>{depts.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
          <select className="input !w-auto" aria-label="Age" value={fl.minor} onChange={(e) => set({ minor: e.target.value })}><option value="">All ages</option><option value="0">18 and over</option><option value="1">Under 18</option></select>
          <label className="flex items-center gap-2 rounded-xl px-2 text-sm text-white/70"><input type="checkbox" checked={fl.leaders === "1"} onChange={(e) => set({ leaders: e.target.checked ? "1" : "" })} />Leaders only</label>
          <div className="ml-auto flex gap-1.5">{(["csv", "xlsx", "pdf"] as const).map((f) => <a key={f} className="btn btn-ghost btn-sm" href={`/api/members?${qs}${qs ? "&" : ""}format=${f}`} title="Export the list with these filters (recorded in the audit log)"><Download className="h-3.5 w-3.5" />{f.toUpperCase()}</a>)}</div>
        </div>
      </div>

      <p className="mb-2 text-xs text-white/50">{d ? `${d.total} member${d.total === 1 ? "" : "s"}` : "Loading…"} · Under-18 contact details are visible only to the parish administrator.</p>
      <div className="grid gap-2.5">
        {!d && [0, 1, 2].map((i) => <div key={i} className="skeleton h-16" />)}
        {d?.rows.map((m: any) => (
          <button key={m.id} onClick={() => setOpenId(m.id)} className="glass flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-left transition hover:-translate-y-0.5">
            <div className="min-w-0">
              <p className="flex items-center gap-2 truncate font-semibold">{m.name}{m.minor && <span className="badge badge-warn">Under 18</span>}{m.leadership && <span className="badge">{m.leadership.title}</span>}</p>
              <p className="truncate text-xs text-white/50">{m.restricted ? <span className="inline-flex items-center gap-1"><Lock className="h-3 w-3" />Contact protected</span> : m.phone} · {[m.zone, m.area, m.parish].filter(Boolean).join(" → ")}</p>
            </div>
            <div className="flex items-center gap-2"><span className="badge">{m.category}</span><span className={STATUS_BADGE[m.status] ?? "badge"}>{STATUS_LABEL[m.status as keyof typeof STATUS_LABEL] ?? m.status}</span><span className="badge font-mono">{m.memberId}</span></div>
          </button>
        ))}
        {d?.rows.length === 0 && <div className="glass p-10 text-center text-white/50">No members match.</div>}
      </div>
      {d && d.pages > 1 && <div className="mt-4 flex items-center justify-center gap-3 text-sm"><button className="btn btn-ghost btn-sm" disabled={fl.page <= 1} onClick={() => setFl({ ...fl, page: fl.page - 1 })}>Previous</button><span>Page {fl.page} of {d.pages}</span><button className="btn btn-ghost btn-sm" disabled={fl.page >= d.pages} onClick={() => setFl({ ...fl, page: fl.page + 1 })}>Next</button></div>}

      <AddMember open={add} onClose={() => setAdd(false)} role={role} org={org} depts={depts} cats={d?.categories ?? []} onDone={(id) => { setAdd(false); load(); toast.ok(`Added. Member ID: ${id}`); }} />
      <Detail id={openId} onClose={() => setOpenId(null)} role={role} org={org} depts={depts} cats={d?.categories ?? []} onChanged={load} />
      {cats && <Categories onClose={() => { setCats(false); load(); }} />}
    </>
  );
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) { return <div><label className="label">{label}</label>{children}{hint && <p className="hint">{hint}</p>}</div>; }

function Dept({ depts, value, onChange }: { depts: any[]; value: string[]; onChange: (v: string[]) => void }) {
  return <div className="flex flex-wrap gap-2">{depts.map((x) => { const on = value.includes(x.id); return <button type="button" key={x.id} onClick={() => onChange(on ? value.filter((v) => v !== x.id) : [...value, x.id])} className={cn("rounded-full border px-3 py-1 text-xs font-semibold", on ? "border-brand bg-brand/20 text-brand" : "border-white/15 text-white/60")}>{x.name}</button>; })}{!depts.length && <p className="text-xs text-white/40">No departments yet.</p>}</div>;
}

const isMinorDob = (dob: string) => !!dob && (Date.now() - new Date(dob).getTime()) / 31_557_600_000 < 18;

function AddMember({ open, onClose, role, org, depts, cats, onDone }: any) {
  const toast = useToast();
  const blank = { name: "", phone: "", email: "", parish: "", dob: "", gender: "", category: "", status: "active", joinedAt: today(), departments: [] as string[], lTitle: "", lLevel: "parish", gName: "", gPhone: "", gRel: "", gConsent: false, privacy: false };
  const [f, setF] = useState(blank);
  const [busy, setBusy] = useState(false);
  const minor = isMinorDob(f.dob);
  async function save() {
    setBusy(true);
    try {
      const r = await api("/api/members", { method: "POST", json: {
        name: f.name, phone: f.phone, email: f.email, dob: f.dob, gender: f.gender, status: f.status, joinedAt: f.joinedAt, departments: f.departments, privacyNotice: f.privacy,
        ...(role !== "parish_admin" ? { parish: f.parish } : {}), ...(f.category ? { category: f.category } : {}),
        ...(f.lTitle ? { leadership: { title: f.lTitle, level: f.lLevel } } : {}),
        ...(minor ? { guardian: { name: f.gName, phone: f.gPhone, relationship: f.gRel }, guardianConsent: f.gConsent } : {}),
      } });
      setF(blank); onDone(r.memberId);
    } catch (e: any) { toast.err(e.message); }
    setBusy(false);
  }
  return (
    <Modal open={open} onClose={onClose} title="Add member" wide>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Phone"><input className="input" type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
        <Field label="Email (optional)"><input className="input" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Date of birth"><input className="input" type="date" max={today()} value={f.dob} onChange={(e) => setF({ ...f, dob: e.target.value })} /></Field>
        <Field label="Gender"><select className="input" value={f.gender} onChange={(e) => setF({ ...f, gender: e.target.value })}><option value="">Prefer not to say</option><option value="male">Male</option><option value="female">Female</option></select></Field>
        {role !== "parish_admin" && <Field label="Parish"><select className="input" value={f.parish} onChange={(e) => setF({ ...f, parish: e.target.value })}><option value="">Select…</option>{org?.parishes.map((p: any) => <option key={p.id} value={p.id}>{org.zones.find((z: any) => z.id === p.zone)?.name} → {p.name}</option>)}</select></Field>}
        <Field label="Category"><select className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}><option value="">Default</option>{cats.map((c: any) => <option key={c.key}>{c.label}</option>)}</select></Field>
        <Field label="Status"><select className="input" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>{MEMBER_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select></Field>
        <Field label="Date joined"><input className="input" type="date" max={today()} value={f.joinedAt} onChange={(e) => setF({ ...f, joinedAt: e.target.value })} /></Field>
        <div className="grid grid-cols-[1fr_120px] gap-2"><Field label="Leadership title (if any)"><input className="input" placeholder="e.g. Youth President" value={f.lTitle} onChange={(e) => setF({ ...f, lTitle: e.target.value })} /></Field><Field label="Level"><select className="input" value={f.lLevel} onChange={(e) => setF({ ...f, lLevel: e.target.value })}><option value="parish">Parish</option><option value="area">Area</option><option value="zone">Zone</option><option value="province">Province</option></select></Field></div>
      </div>
      <div className="mt-4"><label className="label">Departments</label><Dept depts={depts} value={f.departments} onChange={(v) => setF({ ...f, departments: v })} /></div>
      {minor && (
        <div className="mt-4 space-y-3 rounded-2xl border border-accent/40 bg-accent/10 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4 text-accent" />Under 18: parent or guardian details and consent are required</p>
          {role !== "parish_admin" && role !== "super_admin" && <p className="text-xs text-red-300">Only the Parish Administrator can register a member under 18.</p>}
          <div className="grid gap-3 sm:grid-cols-3"><input className="input" placeholder="Guardian full name" value={f.gName} onChange={(e) => setF({ ...f, gName: e.target.value })} /><input className="input" type="tel" placeholder="Guardian phone" value={f.gPhone} onChange={(e) => setF({ ...f, gPhone: e.target.value })} /><input className="input" placeholder="Relationship" value={f.gRel} onChange={(e) => setF({ ...f, gRel: e.target.value })} /></div>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={f.gConsent} onChange={(e) => setF({ ...f, gConsent: e.target.checked })} />The parent or guardian has agreed to this young person being registered and has been told how their details are used.</label>
        </div>
      )}
      <label className="mt-4 flex items-start gap-2 text-sm text-white/70"><input type="checkbox" className="mt-1" checked={f.privacy} onChange={(e) => setF({ ...f, privacy: e.target.checked })} />I have told this member how their details are used and who can see them.</label>
      <button className="btn btn-primary mt-5 w-full py-3" disabled={busy || !f.privacy} onClick={save}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Add member</button>
    </Modal>
  );
}

const TABS = ["Profile", "History", "Volunteer", "Follow-up", "Changes"] as const;

function Detail({ id, onClose, role, org, depts, cats, onChanged }: any) {
  const toast = useToast();
  const [d, setD] = useState<any>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Profile");
  const [f, setF] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => { if (!id) return; api(`/api/members/${id}`).then((r) => { setD(r); const m = r.member; setF(m.restricted ? null : { name: m.name, phone: m.phone, email: m.email ?? "", dob: day(m.dob), gender: m.gender ?? "", category: m.category, status: m.status, joinedAt: day(m.joinedAt), parish: m.parishId, departments: m.departmentIds ?? [], lTitle: m.leadership?.title ?? "", lLevel: m.leadership?.level || "parish", gName: m.guardian?.name ?? "", gPhone: m.guardian?.phone ?? "", gRel: m.guardian?.relationship ?? "", reason: "" }); }).catch((e) => { toast.err(e.message); onClose(); }); }, [id, toast, onClose]);
  useEffect(() => { setD(null); setTab("Profile"); load(); }, [load]);
  const m = d?.member;
  const act = async (json: any, ok: string) => { setBusy(true); try { await api(`/api/members/${id}`, { method: "PATCH", json }); toast.ok(ok); load(); onChanged(); } catch (e: any) { toast.err(e.message); } setBusy(false); };
  const save = () => act({ action: "update", name: f.name, phone: f.phone, email: f.email, ...(f.dob ? { dob: f.dob } : {}), gender: f.gender, category: f.category, status: f.status, joinedAt: f.joinedAt, parish: f.parish, departments: f.departments, leadership: { title: f.lTitle, level: f.lTitle ? f.lLevel : "" }, ...(m?.minor || (f.gName && f.gPhone && f.gRel) ? { guardian: { name: f.gName, phone: f.gPhone, relationship: f.gRel } } : {}), reason: f.reason }, "Saved");
  const tabs = TABS.filter((t) => (t !== "Follow-up" || d?.canFollowUp) && !(m?.restricted && t !== "Profile"));

  return (
    <Modal open={!!id} onClose={onClose} title={m ? `${m.name} · ${m.memberId}` : "Member"} wide>
      {!d && <div className="grid place-items-center py-16"><Loader2 className="h-5 w-5 animate-spin text-brand" /></div>}
      {m?.restricted && <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm"><p className="flex items-center gap-2 font-semibold"><Lock className="h-4 w-4" />This member is under 18</p><p className="mt-2 text-white/60">Personal and contact details of members under 18 are visible only to their Parish Administrator. You can see where they belong: {[m.zone, m.area, m.parish].filter(Boolean).join(" → ")}, category {m.category}.</p></div>}
      {m && !m.restricted && f && (
        <>
          <div className="mb-4 flex flex-wrap gap-1.5">{tabs.map((t) => <button key={t} onClick={() => setTab(t)} className={cn("rounded-xl px-3.5 py-1.5 text-sm font-semibold", tab === t ? "bg-brand text-[#04130d]" : "bg-white/5 text-white/65")}>{t}</button>)}</div>

          {tab === "Profile" && (
            <div className="space-y-4">
              {m.minor && (
                <div className={cn("rounded-2xl border p-4 text-sm", m.guardianVerified ? "border-emerald-400/30 bg-emerald-400/10" : "border-accent/40 bg-accent/10")}>
                  <p className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4" />Under 18 · guardian consent {m.guardianVerified ? "verified" : "not yet verified"}</p>
                  {!m.guardianVerified && <><p className="mt-1 text-xs text-white/65">Until the parent or guardian is confirmed, this member can't register for events online.</p><button className="btn btn-primary btn-sm mt-2" disabled={busy} onClick={() => act({ action: "update", verifyGuardian: true, reason: "Guardian consent confirmed" }, "Guardian verified")}>Mark consent as verified</button></>}
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full name"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
                <Field label="Phone"><input className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
                <Field label="Email"><input className="input" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
                <Field label="Date of birth" hint={m.dobMissing ? "Not recorded yet" : m.age !== null ? `${m.age} years old` : undefined}><input className="input" type="date" max={today()} value={f.dob} onChange={(e) => setF({ ...f, dob: e.target.value })} /></Field>
                <Field label="Parish (moving a member updates their area and zone too)"><select className="input" value={f.parish} onChange={(e) => setF({ ...f, parish: e.target.value })}>{(org?.parishes ?? []).map((p: any) => <option key={p.id} value={p.id}>{org.zones.find((z: any) => z.id === p.zone)?.name} → {p.name}</option>)}</select></Field>
                <Field label="Category"><select className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{[...new Set([f.category, ...cats.map((c: any) => c.label)])].map((c: any) => <option key={c}>{c}</option>)}</select></Field>
                <Field label="Status"><select className="input" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>{MEMBER_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select></Field>
                <Field label="Date joined"><input className="input" type="date" value={f.joinedAt} onChange={(e) => setF({ ...f, joinedAt: e.target.value })} /></Field>
                <Field label="Gender"><select className="input" value={f.gender} onChange={(e) => setF({ ...f, gender: e.target.value })}><option value="">Not stated</option><option value="male">Male</option><option value="female">Female</option></select></Field>
                <div className="grid grid-cols-[1fr_120px] gap-2"><Field label="Leadership title"><input className="input" value={f.lTitle} onChange={(e) => setF({ ...f, lTitle: e.target.value })} /></Field><Field label="Level"><select className="input" value={f.lLevel} onChange={(e) => setF({ ...f, lLevel: e.target.value })}><option value="parish">Parish</option><option value="area">Area</option><option value="zone">Zone</option><option value="province">Province</option></select></Field></div>
              </div>
              <div><label className="label">Departments</label><Dept depts={depts} value={f.departments} onChange={(v) => setF({ ...f, departments: v })} /></div>
              {m.minor && <div className="grid gap-3 sm:grid-cols-3"><Field label="Guardian name"><input className="input" value={f.gName} onChange={(e) => setF({ ...f, gName: e.target.value })} /></Field><Field label="Guardian phone"><input className="input" value={f.gPhone} onChange={(e) => setF({ ...f, gPhone: e.target.value })} /></Field><Field label="Relationship"><input className="input" value={f.gRel} onChange={(e) => setF({ ...f, gRel: e.target.value })} /></Field></div>}
              <Field label="Reason for change (kept in the change log)"><input className="input" placeholder="Optional, e.g. moved to another parish" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></Field>
              <button className="btn btn-primary" disabled={busy} onClick={save}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Save changes</button>
            </div>
          )}

          {tab === "History" && d.history && (
            <div className="grid gap-4 md:grid-cols-2">
              <div><p className="mb-2 font-bold">Event registrations ({d.history.events.length})</p><ul className="space-y-1.5 text-sm">{d.history.events.map((e: any) => <li key={e.id} className="flex justify-between gap-2 rounded-lg bg-white/5 px-3 py-2"><span className="truncate">{e.title}<span className="block text-xs text-white/45">{fmt(e.startsAt)}</span></span><span className={cn("badge self-center", e.attended && "badge-ok")}>{e.attended ? "Attended" : "Registered"}</span></li>)}{!d.history.events.length && <li className="text-white/45">None yet.</li>}</ul></div>
              <div><p className="mb-2 font-bold">Attendance ({d.history.attendance.length})</p><ul className="space-y-1.5 text-sm">{d.history.attendance.map((a: any) => <li key={a.id} className="flex justify-between gap-2 rounded-lg bg-white/5 px-3 py-2"><span className="truncate">{a.title}</span><span className="shrink-0 text-xs text-white/45">{fmt(a.at)}</span></li>)}{!d.history.attendance.length && <li className="text-white/45">None yet.</li>}</ul></div>
            </div>
          )}

          {tab === "Volunteer" && <Volunteer d={d} onAdd={(v: any) => act({ action: "volunteer_add", ...v }, "Recorded")} busy={busy} />}
          {tab === "Follow-up" && d.followUps && <FollowUp d={d} busy={busy} onAct={act} />}
          {tab === "Changes" && <ul className="space-y-1.5 text-sm">{d.changes.map((c: any, i: number) => <li key={i} className="rounded-lg bg-white/5 px-3 py-2"><b>{c.field}</b>{c.from || c.to ? <>: <span className="text-white/50">{c.from || "—"}</span> → {c.to || "—"}</> : null}<span className="block text-xs text-white/45">{c.byName ?? "system"} · {new Date(c.at).toLocaleString("en-NG")}{c.reason ? ` · ${c.reason}` : ""}</span></li>)}{!d.changes.length && <li className="text-white/45">No changes recorded.</li>}</ul>}
        </>
      )}
    </Modal>
  );
}

function Volunteer({ d, onAdd, busy }: any) {
  const [v, setV] = useState({ title: "", at: today(), hours: "", note: "" });
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4"><input className="input sm:col-span-2" placeholder="What did they do? (e.g. Ushering at Gratitude)" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} /><input className="input" type="date" max={today()} value={v.at} onChange={(e) => setV({ ...v, at: e.target.value })} /><input className="input" type="number" min={0} placeholder="Hours" value={v.hours} onChange={(e) => setV({ ...v, hours: e.target.value })} /></div>
      <button className="btn btn-primary btn-sm" disabled={busy || v.title.length < 2} onClick={() => { onAdd({ title: v.title, at: v.at, ...(v.hours ? { hours: Number(v.hours) } : {}), note: v.note }); setV({ ...v, title: "", hours: "" }); }}>Record service</button>
      <ul className="space-y-1.5 text-sm">{d.volunteer.map((x: any) => <li key={x.id} className="flex justify-between gap-3 rounded-lg bg-white/5 px-3 py-2"><span>{x.title}{x.hours ? <span className="text-white/45"> · {x.hours}h</span> : null}</span><span className="text-xs text-white/45">{fmt(x.at)}</span></li>)}{!d.volunteer.length && <li className="text-white/45">No volunteer service recorded.</li>}</ul>
    </div>
  );
}

function FollowUp({ d, onAct, busy }: any) {
  const [v, setV] = useState({ kind: "call", note: "", nextAt: "" });
  return (
    <div className="space-y-4">
      <p className="text-xs text-white/50">Follow-up notes are private to authorised administrators. The member never sees them.</p>
      <div className="grid gap-3 sm:grid-cols-[140px_1fr_160px]"><select className="input" value={v.kind} onChange={(e) => setV({ ...v, kind: e.target.value })}>{["call", "visit", "message", "meeting", "other"].map((k) => <option key={k}>{k}</option>)}</select><input className="input" placeholder="What happened or needs to happen?" value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} /><input className="input" type="date" title="Next follow-up" value={v.nextAt} onChange={(e) => setV({ ...v, nextAt: e.target.value })} /></div>
      <button className="btn btn-primary btn-sm" disabled={busy || v.note.length < 2} onClick={() => { onAct({ action: "followup_add", kind: v.kind, note: v.note, ...(v.nextAt ? { nextAt: v.nextAt } : {}) }, "Follow-up recorded"); setV({ ...v, note: "", nextAt: "" }); }}>Add follow-up</button>
      <ul className="space-y-2 text-sm">{d.followUps.map((x: any) => <li key={x.id} className="rounded-xl bg-white/5 p-3"><div className="flex items-start justify-between gap-3"><p><span className="badge mr-2 capitalize">{x.kind}</span>{x.note}</p>{x.done ? <span className="badge badge-ok">Done</span> : <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => onAct({ action: "followup_done", followUpId: x.id }, "Marked done")}>Mark done</button>}</div><p className="mt-1 text-xs text-white/45">{x.byName} · {fmt(x.at)}{x.nextAt && !x.done ? ` · next ${fmt(x.nextAt)}` : ""}{x.outcome ? ` · ${x.outcome}` : ""}</p></li>)}{!d.followUps.length && <li className="text-white/45">No follow-up yet.</li>}</ul>
    </div>
  );
}

function Categories({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const [list, setList] = useState<{ label: string; active: boolean }[] | null>(null);
  const [nw, setNw] = useState("");
  useEffect(() => { api("/api/members/categories").then((r) => setList(r.list)).catch((e) => toast.err(e.message)); }, [toast]);
  const save = async () => { try { await api("/api/members/categories", { method: "PUT", json: { list } }); toast.ok("Categories saved"); onClose(); } catch (e: any) { toast.err(e.message); } };
  return (
    <Modal open onClose={onClose} title="Membership categories">
      <p className="mb-3 text-xs text-white/55">Switching a category off hides it from new members; people already in it keep it.</p>
      <ul className="space-y-2">{list?.map((c, i) => <li key={c.label} className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2 text-sm"><span>{c.label}</span><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={c.active} onChange={(e) => setList(list.map((x, j) => (j === i ? { ...x, active: e.target.checked } : x)))} />Active</label></li>)}</ul>
      <div className="mt-3 flex gap-2"><input className="input" placeholder="New category" value={nw} onChange={(e) => setNw(e.target.value)} /><button className="btn btn-ghost" disabled={nw.trim().length < 2} onClick={() => { if (list && !list.some((c) => c.label.toLowerCase() === nw.trim().toLowerCase())) setList([...list, { label: nw.trim(), active: true }]); setNw(""); }}>Add</button></div>
      <button className="btn btn-primary mt-4 w-full" onClick={save}>Save categories</button>
    </Modal>
  );
}
