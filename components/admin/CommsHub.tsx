"use client";
import { motion } from "framer-motion";
import { Loader2, Send } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { api } from "@/lib/fetcher";
import { CATEGORIES, EVENTS } from "@/lib/notify-events";
import { Field, fmtDT, MemberPicker, useOrg, type Me } from "./gov/shared";

const TABS = ["Compose", "Delivery log", "Reminders"] as const;
const isProv = (r: string) => r === "super_admin" || r === "provincial_admin";

export function CommsHub({ me }: { me: Me }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Compose");
  const tabs = TABS.filter((t) => t !== "Reminders" || isProv(me.role));
  return (
    <>
      <div className="glass mb-5 flex gap-1 overflow-x-auto p-1">{tabs.map((t) => <button key={t} onClick={() => setTab(t)} className={cn("relative whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold", tab === t ? "text-[#04130d]" : "text-white/60")}>{tab === t && <motion.span layoutId="comms-tab" className="absolute inset-0 rounded-xl bg-brand" />}<span className="relative">{t}</span></button>)}</div>
      {tab === "Compose" && <Compose me={me} onSent={() => setTab("Delivery log")} />}
      {tab === "Delivery log" && <Logs me={me} />}
      {tab === "Reminders" && <Reminders />}
    </>
  );
}

type Aud = { type: string; ids: string[]; eventId: string };

function Compose({ me, onSent }: { me: Me; onSent: () => void }) {
  const toast = useToast();
  const org = useOrg();
  const [f, setF] = useState({ title: "", body: "", link: "", kind: "notice" });
  const [ch, setCh] = useState({ email: false, push: true });
  const types = me.role === "event_admin" ? [["event", "People registered for an event"]] : [...(isProv(me.role) ? [["everyone", "Everyone"]] : []), ["zones", "Specific zones"], ["areas", "Specific areas"], ["parishes", "Specific parishes"], ["departments", "A department"], ["event", "People registered for an event"], ["members", "Selected members"]];
  const [aud, setAud] = useState<Aud>({ type: types[0][0], ids: [], eventId: "" });
  const [deps, setDeps] = useState<any[]>([]);
  const [evs, setEvs] = useState<any[]>([]);
  const [picked, setPicked] = useState<{ id: string; name: string }[]>([]);
  const [one, setOne] = useState<{ id: string; name: string } | null>(null);
  const [prev, setPrev] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api("/api/governance/departments").then((r) => setDeps(r.rows)).catch(() => {}); api("/api/public/events").then((r) => setEvs(r.rows ?? r.events ?? [])).catch(() => {}); }, []);
  useEffect(() => { setPrev(null); }, [aud, ch]);
  // A draft handed over from the AI assistant: loaded once, then removed. The sender still reviews and presses Send.
  useEffect(() => { try { const raw = sessionStorage.getItem("comms-prefill"); if (raw) { sessionStorage.removeItem("comms-prefill"); const d = JSON.parse(raw); setF((x) => ({ ...x, title: String(d.title || "").slice(0, 120), body: String(d.body || "").slice(0, 2000) })); } } catch { /* ignore */ } }, []);
  const zones = (org?.zones ?? []).filter((z: any) => !me.zone || z.id === me.zone);
  const areas = (org?.areas ?? []).filter((a: any) => (!me.zone || a.zone === me.zone) && (!me.area || a.id === me.area));
  const parishes = (org?.parishes ?? []).filter((p: any) => (!me.zone || p.zone === me.zone) && (!me.area || p.area === me.area) && (!me.parish || p.id === me.parish));
  const toggle = (id: string) => setAud((a) => ({ ...a, ids: a.ids.includes(id) ? a.ids.filter((x) => x !== id) : [...a.ids, id] }));
  const spec = { type: aud.type, ...(aud.type === "event" ? { eventId: aud.eventId } : aud.type === "members" ? { ids: picked.map((p) => p.id) } : aud.type === "everyone" ? {} : { ids: aud.ids }) };
  const ready = f.title.trim().length >= 3 && (aud.type === "everyone" || (aud.type === "event" ? !!aud.eventId : aud.type === "members" ? picked.length > 0 : aud.ids.length > 0));

  const check = async () => { setBusy(true); try { setPrev(await api("/api/comms/audience", { method: "POST", json: { audience: spec } })); } catch (e: any) { toast.err(e.message); } setBusy(false); };
  const send = async () => {
    setBusy(true);
    try { const r = await api("/api/comms/send", { method: "POST", json: { ...f, link: f.link || undefined, audience: spec, channels: ch } }); toast.ok(`Sent to ${r.recipients} ${r.recipients === 1 ? "person" : "people"}`); setF({ title: "", body: "", link: "", kind: "notice" }); setPrev(null); onSent(); }
    catch (e: any) { toast.err(e.message); }
    setBusy(false);
  };
  const list = (rows: any[], label = "name") => <div className="grid max-h-60 gap-1 overflow-y-auto rounded-xl border border-white/10 p-2 sm:grid-cols-2">{rows.map((r) => <label key={r.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-white/5"><input type="checkbox" checked={aud.ids.includes(r.id)} onChange={() => toggle(r.id)} />{r[label]}{r.place && r.level !== "province" ? <span className="text-xs text-white/40"> · {r.place}</span> : null}</label>)}{!rows.length && <p className="p-2 text-sm text-white/45">Nothing to choose.</p>}</div>;

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <div className="glass space-y-4 p-5">
        <div className="grid gap-3 sm:grid-cols-[160px_1fr]"><Field label="Kind"><select className="input" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}><option value="notice">Notice</option><option value="announcement">Announcement</option></select></Field><Field label="Title"><input className="input" maxLength={120} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field></div>
        <Field label="Message"><textarea className="input min-h-[110px]" maxLength={2000} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></Field>
        <Field label="Open this page when tapped (optional)"><select className="input" value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })}><option value="">Nothing in particular</option><option value="/announcements">Announcements</option><option value="/events">Events</option><option value="/member">My page</option><option value="/admin">Dashboard</option></select></Field>
        <div>
          <label className="label">Who should get it?</label>
          <div className="mb-3 flex flex-wrap gap-2">{types.map(([k, l]) => <button key={k} type="button" onClick={() => { setAud({ type: k, ids: [], eventId: "" }); setPicked([]); }} className={cn("rounded-full border px-3.5 py-1.5 text-sm font-semibold", aud.type === k ? "border-brand bg-brand/20 text-brand" : "border-white/15 text-white/60")}>{l}</button>)}</div>
          {aud.type === "zones" && list(zones)}
          {aud.type === "areas" && list(areas)}
          {aud.type === "parishes" && list(parishes)}
          {aud.type === "departments" && list(deps)}
          {aud.type === "event" && <select className="input" value={aud.eventId} onChange={(e) => setAud({ ...aud, eventId: e.target.value })}><option value="">Choose an event…</option>{evs.map((e: any) => <option key={e.id} value={e.id}>{e.title}</option>)}</select>}
          {aud.type === "members" && <div className="space-y-2"><MemberPicker org={{ level: "province" }} value={one} onChange={(v) => { if (v && !picked.some((p) => p.id === v.id)) setPicked([...picked, v]); setOne(null); }} label="Add members" /><div className="flex flex-wrap gap-1.5">{picked.map((p) => <span key={p.id} className="badge">{p.name}<button className="ml-1.5 text-white/50 hover:text-white" onClick={() => setPicked(picked.filter((x) => x.id !== p.id))} aria-label={`Remove ${p.name}`}>×</button></span>)}</div></div>}
          {aud.type === "everyone" && <p className="text-sm text-white/55">Every account holder, plus members who have an email address.</p>}
        </div>
        <div>
          <label className="label">How</label>
          <div className="flex flex-wrap gap-4 text-sm"><label className="flex items-center gap-2 opacity-70"><input type="checkbox" checked disabled />In-app (always)</label><label className="flex items-center gap-2"><input type="checkbox" checked={ch.push} onChange={(e) => setCh({ ...ch, push: e.target.checked })} />Push</label><label className="flex items-center gap-2"><input type="checkbox" checked={ch.email} onChange={(e) => setCh({ ...ch, email: e.target.checked })} />Email</label></div>
          <p className="hint">Each person's own settings still apply. If a channel can't reach someone, the in-app notice still does.</p>
        </div>
      </div>
      <div className="glass h-fit space-y-3 p-5">
        <p className="font-bold">Before you send</p>
        <button className="btn btn-ghost w-full" disabled={!ready || busy} onClick={check}>{busy && !prev ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Check who will get it</button>
        {prev && (
          <div className="space-y-1.5 text-sm">
            <p className="text-2xl font-extrabold">{prev.stats.total} <span className="text-sm font-normal text-white/55">{prev.stats.total === 1 ? "person" : "people"}</span></p>
            <p className="text-white/60">{prev.labels.join(", ")}</p>
            <ul className="space-y-0.5 text-xs text-white/55"><li>{prev.stats.accounts} with an account (in-app, push, email)</li><li>{prev.stats.emailOnly} email only</li>{prev.stats.minorsInAppOnly > 0 && <li>{prev.stats.minorsInAppOnly} under 18: in-app and push only, never email</li>}{prev.stats.unreachable > 0 && <li>{prev.stats.unreachable} can't be reached (no account or email)</li>}{prev.capped && <li className="text-amber-300">Capped at 5,000 people.</li>}</ul>
            <button className="btn btn-primary mt-2 w-full py-3" disabled={busy || prev.stats.total === 0} onClick={send}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Send to {prev.stats.total}</button>
          </div>
        )}
        {!prev && <p className="text-xs text-white/50">Choose the audience, then check the numbers. Nothing is sent until you press Send.</p>}
      </div>
    </div>
  );
}

const STATUS: Record<string, string> = { done: "badge badge-ok", partial: "badge badge-warn", failed: "badge badge-bad" };

function Logs({ me }: { me: Me }) {
  const toast = useToast();
  const [rows, setRows] = useState<any[] | null>(null);
  const [origin, setOrigin] = useState("manual");
  const [problems, setProblems] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const load = useCallback(() => { setRows(null); api(`/api/comms/logs?${new URLSearchParams({ origin, ...(problems ? { status: "problems" } : {}) })}`).then((r) => setRows(r.rows)).catch((e) => { toast.err(e.message); setRows([]); }); }, [origin, problems, toast]);
  useEffect(() => { load(); }, [load]);
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {isProv(me.role) && <select className="input !w-auto" value={origin} onChange={(e) => setOrigin(e.target.value)}><option value="manual">Messages sent by people</option><option value="system">Automatic notifications</option></select>}
        <label className="flex items-center gap-2 text-sm text-white/70"><input type="checkbox" checked={problems} onChange={(e) => setProblems(e.target.checked)} />Only ones with problems</label>
      </div>
      {!rows && <div className="skeleton h-24" />}
      <div className="space-y-2">{rows?.map((l) => { const t = l.totals ?? {}; return (
        <button key={l.id} onClick={() => setOpen(l.id)} className="glass flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-left transition hover:-translate-y-0.5">
          <div className="min-w-0"><p className="truncate font-semibold">{l.title}</p><p className="truncate text-xs text-white/50">{fmtDT(l.at)} · {l.audience?.labels?.join(", ") || (l.event && (EVENTS as any)[l.event]?.label) || "—"}{l.sentByName ? ` · ${l.sentByName}` : ""}</p></div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs"><span className="badge">{t.recipients ?? 0} people</span>{(t.emailSent ?? 0) + (t.externalSent ?? 0) > 0 && <span className="badge">{(t.emailSent ?? 0) + (t.externalSent ?? 0)} emailed</span>}{t.pushSent > 0 && <span className="badge">{t.pushSent} pushed</span>}{l.failures > 0 && <span className="badge badge-bad">{l.failures} failed</span>}<span className={STATUS[l.status]}>{l.status}</span></div>
        </button>); })}
        {rows?.length === 0 && <div className="glass p-10 text-center text-white/50">Nothing here yet.</div>}</div>
      {open && <LogDetail id={open} onClose={() => { setOpen(null); load(); }} />}
    </>
  );
}

function LogDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const toast = useToast();
  const [d, setD] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => api(`/api/comms/logs/${id}`).then(setD).catch((e) => { toast.err(e.message); onClose(); }), [id, toast, onClose]);
  useEffect(() => { load(); }, [load]);
  const retry = async () => { setBusy(true); try { const r = await api(`/api/comms/logs/${id}`, { method: "POST" }); toast.ok(`${r.fixed} delivered now, ${r.still} still failing`); load(); } catch (e: any) { toast.err(e.message); } setBusy(false); };
  const t = d?.log.totals ?? {};
  const open = d?.failures.filter((f: any) => !f.retried) ?? [];
  const rowsT: [string, any][] = [["Recipients", t.recipients], ["In-app notices", t.inApp], ["Emails sent", t.emailSent], ["Emails to people without an account", t.externalSent], ["Emails failed", (t.emailFailed ?? 0) + (t.externalFailed ?? 0)], ["Email skipped (turned off, or not set up)", t.emailSkipped], ["Push delivered", t.pushSent], ["Push failed", t.pushFailed], ["No device connected", t.pushNoDevice], ["Push turned off by the person", t.pushSkipped]];
  return (
    <Modal open onClose={onClose} title={d?.log.title ?? "Delivery details"} wide>
      {!d && <div className="grid place-items-center py-12"><Loader2 className="h-5 w-5 animate-spin text-brand" /></div>}
      {d && (
        <div className="space-y-5">
          <p className="text-sm text-white/60">{fmtDT(d.log.at)} · {d.log.sentByName ?? "Automatic"} · {d.log.labels.join(", ") || "—"}</p>
          {d.log.body && <p className="whitespace-pre-wrap rounded-xl bg-white/5 p-3 text-sm">{d.log.body}</p>}
          <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">{rowsT.map(([l, v]) => <div key={l} className="flex justify-between border-b border-white/5 py-1"><dt className="text-white/60">{l}</dt><dd className="tabular-nums">{v ?? 0}</dd></div>)}</dl>
          <div>
            <div className="mb-2 flex items-center justify-between"><p className="font-bold">Failures {open.length ? `(${open.length})` : ""}</p>{open.length > 0 && <button className="btn btn-primary btn-sm" disabled={busy} onClick={retry}>{busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Try again</button>}</div>
            <ul className="space-y-1.5 text-sm">{d.failures.map((f: any) => <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/5 px-3 py-2"><span>{f.name ?? "—"}<span className="text-xs text-white/45"> · {f.channel}{f.to ? ` · ${f.to}` : ""}</span></span><span className={cn("text-xs", f.retried ? "text-emerald-300" : "text-red-300")}>{f.retried ? "Delivered on retry" : f.error}</span></li>)}{!d.failures.length && <li className="text-white/45">No failures.</li>}</ul>
          </div>
        </div>
      )}
    </Modal>
  );
}

function Reminders() {
  const toast = useToast();
  const [d, setD] = useState<any>(null);
  const [c, setC] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<any>(null);
  useEffect(() => { api("/api/comms/settings").then((r) => { setD(r); setC({ ...r.config, lead: r.config.reportLeadDays.join(", ") }); }).catch((e) => toast.err(e.message)); }, [toast]);
  if (!c) return <div className="skeleton h-40" />;
  const save = async () => { setBusy(true); try { const lead = String(c.lead).split(/[ ,]+/).map(Number).filter((n) => n >= 1 && n <= 14); const r = await api("/api/comms/settings", { method: "PUT", json: { enabled: c.enabled, reportDeadlineDay: Number(c.reportDeadlineDay), reportLeadDays: lead, eventHoursAhead: Number(c.eventHoursAhead), meetingHoursAhead: Number(c.meetingHoursAhead), outstandingEveryDays: Number(c.outstandingEveryDays) } }); setC({ ...r.config, lead: r.config.reportLeadDays.join(", ") }); toast.ok("Saved"); } catch (e: any) { toast.err(e.message); } setBusy(false); };
  const run = async () => { setBusy(true); try { setOut(await api("/api/cron/reminders", { method: "POST" })); } catch (e: any) { toast.err(e.message); } setBusy(false); };
  return (
    <div className="space-y-5">
      <div className="glass space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><p className="font-bold">Automatic reminders</p><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={c.enabled} onChange={(e) => setC({ ...c, enabled: e.target.checked })} />Switched on</label></div>
        <div className="flex flex-wrap gap-2 text-xs"><span className={cn("badge", d.cronConfigured ? "badge-ok" : "badge-warn")}>Daily schedule: {d.cronConfigured ? "ready" : "needs CRON_SECRET"}</span><span className={cn("badge", d.email ? "badge-ok" : "badge-warn")}>Email: {d.email ? "set up" : "not set up"}</span><span className={cn("badge", d.push ? "badge-ok" : "badge-warn")}>Push: {d.push ? "set up" : "not set up"}</span></div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Reports are due on day…" hint="Of the month after the one being reported"><input className="input" type="number" min={1} max={28} value={c.reportDeadlineDay} onChange={(e) => setC({ ...c, reportDeadlineDay: e.target.value })} /></Field>
          <Field label="Warn this many days before" hint="e.g. 3, 1"><input className="input" value={c.lead} onChange={(e) => setC({ ...c, lead: e.target.value })} /></Field>
          <Field label="Chase unpaid remittances every (days)"><input className="input" type="number" min={2} max={30} value={c.outstandingEveryDays} onChange={(e) => setC({ ...c, outstandingEveryDays: e.target.value })} /></Field>
          <Field label="Event reminder, hours before"><input className="input" type="number" min={6} max={96} value={c.eventHoursAhead} onChange={(e) => setC({ ...c, eventHoursAhead: e.target.value })} /></Field>
          <Field label="Meeting reminder, hours before"><input className="input" type="number" min={6} max={96} value={c.meetingHoursAhead} onChange={(e) => setC({ ...c, meetingHoursAhead: e.target.value })} /></Field>
        </div>
        <div className="flex flex-wrap gap-2"><button className="btn btn-primary" disabled={busy} onClick={save}>Save</button><button className="btn btn-ghost" disabled={busy} onClick={run}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Run reminders now</button></div>
        {out && <p className="rounded-xl bg-white/5 p-3 text-xs text-white/70">{out.ran ? Object.entries(out.summary).map(([k, v]) => `${k}: ${v}`).join(" · ") : out.summary.note}</p>}
        <p className="text-xs text-white/50">Running it again the same day never notifies anyone twice.</p>
      </div>
      <div className="glass overflow-x-auto p-5">
        <p className="mb-3 font-bold">What triggers a notification, and who gets it</p>
        <table className="w-full min-w-[640px] text-sm"><thead><tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-wide text-white/50"><th className="py-2">Event</th><th>Category</th><th>Who</th></tr></thead><tbody>{Object.values(EVENTS).filter((e) => e.label !== "General").map((e) => <tr key={e.label} className="border-b border-white/5"><td className="py-2 font-semibold">{e.label}</td><td className="text-xs">{CATEGORIES[e.category].label}{CATEGORIES[e.category].locked ? " · always on" : ""}</td><td className="text-xs text-white/60">{e.who}</td></tr>)}</tbody></table>
      </div>
    </div>
  );
}
