"use client";
import { motion } from "framer-motion";
import { BarChart3, Loader2, Plus, QrCode as QrIcon } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/fetcher";
import { cn } from "@/lib/cn";
import { fmtDT, fromLocalInput, toLocalInput } from "@/lib/dates";
import { KINDS } from "@/lib/kinds";
import { Toggle } from "./fields";

const KIND_LABEL: Record<string, string> = { youth_sunday: "Parish Youth Sunday", youth_meeting: "Parish youth meeting", area_meeting: "Area meeting", zonal_meeting: "Zonal meeting", provincial_meeting: "Provincial meeting", convention: "Convention", conference: "Conference", retreat: "Retreat", special: "Special programme", other: "Other" };
const stateBadge: Record<string, string> = { open: "badge-ok", scheduled: "badge-warn", closed: "" };

export function AttendanceManager({ role, canCreate }: { role: string; canCreate: boolean }) {
  const toast = useToast();
  const [tab, setTab] = useState<"sessions" | "report">("sessions");
  const [rows, setRows] = useState<any[] | null>(null);
  const [create, setCreate] = useState(false);
  const load = useCallback(() => api("/api/attendance/sessions").then((r) => setRows(r.sessions)).catch((e) => toast.err(e.message)), [toast]);
  useEffect(() => { load(); }, [load]);
  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="glass flex gap-1 p-1">{([["sessions", "Sessions", QrIcon], ["report", "Reports", BarChart3]] as const).map(([k, l, I]) => <button key={k} onClick={() => setTab(k)} className={cn("relative flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold", tab === k ? "text-[#04130d]" : "text-white/60")}>{tab === k && <motion.span layoutId="att-tab" className="absolute inset-0 rounded-xl bg-brand" />}<span className="relative flex items-center gap-2"><I className="h-4 w-4" />{l}</span></button>)}</div>
        {canCreate && tab === "sessions" && <button className="btn btn-primary" onClick={() => setCreate(true)}><Plus className="h-4 w-4" />New session</button>}
      </div>
      {tab === "sessions" ? (
        <div className="grid gap-3">
          {rows === null && [0, 1, 2].map((i) => <div key={i} className="skeleton h-24" />)}
          {rows?.map((s, i) => (
            <motion.div key={s.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.4) }}>
              <Link href={`/admin/attendance/${s.id}`} className="glass glass-hover flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0"><p className="truncate font-bold">{s.title}</p><p className="truncate text-xs text-white/45">{KIND_LABEL[s.kind] ?? s.kind} · {[s.zone, s.area, s.parish].filter(Boolean).join(" → ") || "Province-wide"} · {fmtDT(s.opensAt)}</p></div>
                <div className="flex items-center gap-2"><span className={cn("badge capitalize", stateBadge[s.state])}>{s.state}</span><span className="badge">{s.count} present{s.visitors ? ` · ${s.visitors} visitors` : ""}</span></div>
              </Link>
            </motion.div>
          ))}
          {rows?.length === 0 && <div className="glass p-10 text-center text-white/45">No attendance sessions yet. Create one to get a QR code.</div>}
        </div>
      ) : <Report />}
      {create && <CreateSession role={role} onClose={() => setCreate(false)} onDone={load} />}
    </>
  );
}

function Report() {
  const toast = useToast();
  const [from, setFrom] = useState(new Date(Date.now() - 90 * 86400_000).toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [d, setD] = useState<any>(null);
  useEffect(() => { setD(null); api(`/api/attendance/report?from=${from}&to=${to}`).then(setD).catch((e) => { toast.err(e.message); setD({ total: 0, trend: [], byZone: [], byArea: [], byParish: [], visitors: 0, sessions: 0 }); }); }, [from, to, toast]);
  const max = (l: any[]) => Math.max(1, ...l.map((x) => x.count));
  const Bars = ({ title, list }: { title: string; list: any[] }) => list.length === 0 ? null : (
    <div className="glass p-5"><p className="mb-3 font-bold">{title}</p><div className="space-y-2.5">{list.map((x) => <div key={x.id}><div className="mb-1 flex justify-between text-xs"><span className="truncate">{x.name}</span><b>{x.count}</b></div><div className="h-2 overflow-hidden rounded-full bg-white/10"><motion.div className="h-full rounded-full bg-gradient-to-r from-brand to-accent" initial={{ width: 0 }} animate={{ width: `${(x.count / max(list)) * 100}%` }} transition={{ duration: 0.8 }} /></div></div>)}</div></div>
  );
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-3"><div><label className="label">From</label><input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div><div><label className="label">To</label><input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div></div>
      {!d ? <div className="skeleton h-40" /> : (<>
        <div className="grid grid-cols-3 gap-3">{[["Total attendance", d.total], ["Sessions", d.sessions], ["Visitors", d.visitors]].map(([l, v]) => <div key={l as string} className="glass p-4"><p className="text-2xl font-black">{v}</p><p className="text-[11px] uppercase tracking-wider text-white/45">{l}</p></div>)}</div>
        {d.trend.length > 0 && <div className="glass p-5"><p className="mb-4 font-bold">Attendance trend</p><div className="flex h-40 items-end gap-1.5 overflow-x-auto">{d.trend.map((t: any) => <div key={t.id} className="group flex min-w-[18px] flex-1 flex-col items-center justify-end gap-1" title={`${t.title}: ${t.count}`}><span className="text-[10px] text-white/50 opacity-0 group-hover:opacity-100">{t.count}</span><motion.div className="w-full rounded-t-md bg-gradient-to-t from-brand/60 to-accent" initial={{ height: 0 }} animate={{ height: `${(t.count / max(d.trend)) * 100}%` }} transition={{ duration: 0.8 }} /></div>)}</div></div>}
        <div className="grid gap-5 lg:grid-cols-3"><Bars title="By zone" list={d.byZone} /><Bars title="By area" list={d.byArea} /><Bars title="By parish" list={d.byParish} /></div>
      </>)}
    </div>
  );
}

function CreateSession({ role, onClose, onDone }: { role: string; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [org, setOrg] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const nowIso = toLocalInput(new Date());
  const [f, setF] = useState<any>({ title: "", description: "", kind: role === "parish_admin" ? "youth_sunday" : "other", level: role === "parish_admin" ? "parish" : role === "area_admin" ? "area" : role === "zonal_admin" ? "zone" : "province", zone: "", area: "", parish: "", event: "", opensAt: nowIso, closesAt: toLocalInput(new Date(Date.now() + 3 * 3600_000)), locOn: false, lat: "", lng: "", radius: "300" });
  const [busy, setBusy] = useState(false);
  useEffect(() => { api("/api/public/org").then(setOrg).catch(() => {}); api("/api/events").then((r) => setEvents(r.events)).catch(() => {}); }, []);
  const scoped = ["parish_admin", "area_admin", "zonal_admin"].includes(role);
  const levels = role === "parish_admin" ? ["parish"] : role === "area_admin" ? ["area", "parish"] : role === "zonal_admin" ? ["zone", "area", "parish"] : ["province", "zone", "area", "parish"];
  const set = (k: string) => (e: any) => setF((x: any) => ({ ...x, [k]: e.target.value }));
  const useMyLocation = () => navigator.geolocation?.getCurrentPosition((p) => setF((x: any) => ({ ...x, lat: String(p.coords.latitude), lng: String(p.coords.longitude) })), () => toast.err("Couldn't read your location. Allow location access and try again."));
  async function save() {
    setBusy(true);
    try {
      const body: any = { title: f.title, description: f.description, kind: f.kind, level: f.level, date: fromLocalInput(f.opensAt), opensAt: fromLocalInput(f.opensAt), closesAt: fromLocalInput(f.closesAt) };
      for (const k of ["zone", "area", "parish", "event"]) if (f[k]) body[k] = f[k];
      if (f.locOn && f.lat && f.lng) body.locationCheck = { enabled: true, lat: Number(f.lat), lng: Number(f.lng), radiusM: Number(f.radius) || 300 };
      await api("/api/attendance/sessions", { method: "POST", json: body });
      toast.ok("Session created. Your QR code is ready."); onClose(); onDone();
    } catch (e: any) { toast.err(e.message); }
    setBusy(false);
  }
  return (
    <Modal open onClose={onClose} wide title="New attendance session">
      <div className="space-y-4">
        <div><label className="label">Title</label><input className="input" value={f.title} onChange={set("title")} placeholder="e.g. Youth Sunday — 3 Nov" /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label">Type</label><select className="input" value={f.kind} onChange={set("kind")}>{KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</select></div>
          <div><label className="label">Level</label><select className="input" value={f.level} onChange={set("level")}>{levels.map((l) => <option key={l} value={l}>{l === "province" ? "Province-wide" : l[0].toUpperCase() + l.slice(1)}</option>)}</select></div>
          {org && !(role === "parish_admin" || (role === "area_admin" && f.level === "area") || (role === "zonal_admin" && f.level === "zone")) && f.level !== "province" && (<>
            {!(role === "area_admin") && <div><label className="label">Zone</label><select className="input" value={f.zone} onChange={(e) => setF({ ...f, zone: e.target.value, area: "", parish: "" })}><option value="">Select…</option>{org.zones.map((z: any) => <option key={z.id} value={z.id}>{z.name}</option>)}</select></div>}
            {["area", "parish"].includes(f.level) && <div><label className="label">Area</label><select className="input" value={f.area} onChange={(e) => setF({ ...f, area: e.target.value, parish: "" })}><option value="">Select…</option>{org.areas.filter((a: any) => !f.zone || a.zone === f.zone).map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>}
            {f.level === "parish" && <div><label className="label">Parish</label><select className="input" value={f.parish} onChange={set("parish")}><option value="">Select…</option>{org.parishes.filter((p: any) => (!f.zone || p.zone === f.zone) && (!f.area || p.area === f.area)).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>}
          </>)}
          <div><label className="label">Opens</label><input className="input" type="datetime-local" value={f.opensAt} onChange={set("opensAt")} /></div>
          <div><label className="label">Closes</label><input className="input" type="datetime-local" value={f.closesAt} onChange={set("closesAt")} /></div>
          {!scoped && <div className="sm:col-span-2"><label className="label">Link to an event (optional)</label><select className="input" value={f.event} onChange={set("event")}><option value="">None</option>{events.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}</select><p className="hint">Linked events automatically mark registrants as attended.</p></div>}
        </div>
        <Toggle label="Add optional location check" hint="Attendees may share their location; it's recorded as an extra signal, not a block." checked={f.locOn} onChange={(v) => setF({ ...f, locOn: v })} />
        {f.locOn && <div className="grid gap-3 sm:grid-cols-4"><input className="input" placeholder="Latitude" value={f.lat} onChange={set("lat")} /><input className="input" placeholder="Longitude" value={f.lng} onChange={set("lng")} /><input className="input" placeholder="Radius (m)" value={f.radius} onChange={set("radius")} /><button type="button" className="btn btn-ghost" onClick={useMyLocation}>Use my location</button></div>}
        <button className="btn btn-primary w-full py-3" disabled={busy || f.title.length < 3} onClick={save}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Create session & QR code</button>
      </div>
    </Modal>
  );
}
