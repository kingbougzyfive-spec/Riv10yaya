"use client";
import { motion } from "framer-motion";
import { CalendarDays, CheckCircle2, Loader2, MapPin, Phone, Mail, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { QrCode } from "@/components/Qr";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/fetcher";
import { cn } from "@/lib/cn";

const fmt = (d: string) => new Date(d).toLocaleString("en-NG", { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export function EventsList({ limit }: { limit?: number } = {}) {
  const [events, setEvents] = useState<any[] | null>(null);
  useEffect(() => { api("/api/public/events").then((r) => setEvents(limit ? r.events.slice(0, limit) : r.events)).catch(() => setEvents([])); }, []);
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {events === null && [0, 1, 2].map((i) => <div key={i} className="skeleton h-72" />)}
      {events?.map((e, i) => (
        <motion.div key={e.id} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.06, 0.4) }}>
          <Link href={`/events/${e.id}`} className="glass glass-hover group block overflow-hidden p-0">
            <div className="relative aspect-[16/10] bg-gradient-to-br from-brand/25 to-accent/25">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {e.flyerId ? <img src={`/api/media/${e.flyerId}`} alt="" className="h-full w-full object-cover transition duration-700 group-hover:scale-105" /> : <div className="grid h-full place-items-center"><CalendarDays className="h-12 w-12 text-white/30" /></div>}
              {e.status === "cancelled" && <span className="badge badge-bad absolute left-3 top-3">Cancelled</span>}
            </div>
            <div className="p-5"><p className="text-xs font-semibold text-accent">{fmt(e.startsAt)}</p><h3 className="mt-1 text-lg font-bold leading-snug">{e.title}</h3>{e.venue && <p className="mt-2 flex items-center gap-1.5 text-sm text-white/55"><MapPin className="h-3.5 w-3.5" />{e.venue}</p>}</div>
          </Link>
        </motion.div>
      ))}
      {events?.length === 0 && <p className="glass col-span-full p-10 text-center text-white/50">No upcoming events right now. Please check back soon.</p>}
    </div>
  );
}

export function EventDetail({ id }: { id: string }) {
  const toast = useToast();
  const router = useRouter();
  const [ev, setEv] = useState<any>(null);
  const [org, setOrg] = useState<any>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState<any>({ name: "", phone: "", email: "", zone: "", area: "", parish: "", answers: {} });
  useEffect(() => { api(`/api/public/events/${id}`).then((r) => setEv(r.event)).catch((e) => setErr(e.message)); api("/api/public/org").then(setOrg).catch(() => {}); }, [id]);

  if (err) return <p className="glass p-10 text-center text-white/60">{err}</p>;
  if (!ev) return <div className="skeleton h-96" />;
  const zone = org?.zones.find((z: any) => z.id === f.zone);
  const areas = org?.areas.filter((a: any) => a.zone === f.zone) ?? [];
  const parishes = org?.parishes.filter((p: any) => p.zone === f.zone && (zone?.hasAreas ? p.area === f.area : true)) ?? [];

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try { const r = await api(`/api/public/events/${id}/register`, { method: "POST", json: { ...f } }); toast.ok("You're registered!"); router.push(`/events/${id}/ticket/${r.reference}`); }
    catch (er: any) { toast.err(er.message); setBusy(false); }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      <div className="space-y-5">
        <div className="glass overflow-hidden p-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {ev.flyerId && <img src={`/api/media/${ev.flyerId}`} alt="" className="max-h-[520px] w-full object-cover" />}
          <div className="space-y-3 p-6">
            {ev.status === "cancelled" && <span className="badge badge-bad">Cancelled</span>}
            <h1 className="text-2xl font-black sm:text-3xl">{ev.title}</h1>
            <p className="flex items-center gap-2 text-accent"><CalendarDays className="h-4 w-4" />{fmt(ev.startsAt)}{ev.endsAt ? ` – ${new Date(ev.endsAt).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })}` : ""}</p>
            {ev.venue && <p className="flex items-center gap-2 text-white/70"><MapPin className="h-4 w-4" />{ev.mapUrl ? <a className="underline" href={ev.mapUrl} target="_blank" rel="noopener noreferrer">{ev.venue}</a> : ev.venue}</p>}
            {ev.description && <p className="whitespace-pre-line pt-2 leading-relaxed text-white/70">{ev.description}</p>}
            <div className="grid gap-2 pt-2 text-sm text-white/60">
              {ev.eligibility && <p className="flex gap-2"><Users className="h-4 w-4 shrink-0" />Open to: {ev.eligibility}</p>}
              {ev.organizers && <p>Organisers: {ev.organizers}</p>}
              {ev.contactPhone && <a className="flex gap-2 hover:text-white" href={`tel:${ev.contactPhone}`}><Phone className="h-4 w-4" />{ev.contactName ? `${ev.contactName} · ` : ""}{ev.contactPhone}</a>}
              {ev.contactEmail && <a className="flex gap-2 hover:text-white" href={`mailto:${ev.contactEmail}`}><Mail className="h-4 w-4" />{ev.contactEmail}</a>}
            </div>
          </div>
        </div>
      </div>
      <div className="lg:sticky lg:top-24 lg:self-start">
        <div className="glass p-6">
          <h2 className="text-lg font-bold">Register</h2>
          {ev.registrationClosed ? <p className="mt-3 rounded-xl bg-white/5 p-4 text-sm text-white/60">{ev.closedReason}</p> : (
            <form onSubmit={submit} className="mt-4 space-y-4">
              {ev.spotsLeft !== null && <p className="text-xs text-accent">{ev.spotsLeft} spots left</p>}
              <div><label className="label">Full name *</label><input className="input" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
              <div><label className="label">Phone *</label><input className="input" required type="tel" inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="0803 000 0000" /></div>
              <div><label className="label">Email (for your confirmation)</label><input className="input" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
              {org && (<>
                <div><label className="label">Zone</label><select className="input" value={f.zone} onChange={(e) => setF({ ...f, zone: e.target.value, area: "", parish: "" })}><option value="">Select zone…</option>{org.zones.map((z: any) => <option key={z.id} value={z.id}>{z.name}</option>)}</select></div>
                {zone?.hasAreas && <div><label className="label">Area</label><select className="input" value={f.area} onChange={(e) => setF({ ...f, area: e.target.value, parish: "" })}><option value="">Select area…</option>{areas.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>}
                {zone && (!zone.hasAreas || f.area) && <div><label className="label">Parish</label><select className="input" value={f.parish} onChange={(e) => setF({ ...f, parish: e.target.value })}><option value="">Select parish…</option>{parishes.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>}
              </>)}
              {ev.customFields.map((c: any) => (
                <div key={c.key}><label className="label">{c.label}{c.required && " *"}</label>
                  {c.type === "select" ? <select className="input" required={c.required} value={f.answers[c.key] ?? ""} onChange={(e) => setF({ ...f, answers: { ...f.answers, [c.key]: e.target.value } })}><option value="">Select…</option>{c.options.map((o: string) => <option key={o}>{o}</option>)}</select>
                    : c.type === "yesno" ? <select className="input" required={c.required} value={f.answers[c.key] ?? ""} onChange={(e) => setF({ ...f, answers: { ...f.answers, [c.key]: e.target.value } })}><option value="">Select…</option><option>Yes</option><option>No</option></select>
                    : <input className="input" required={c.required} value={f.answers[c.key] ?? ""} onChange={(e) => setF({ ...f, answers: { ...f.answers, [c.key]: e.target.value } })} />}
                </div>
              ))}
              <button className="btn btn-primary w-full py-3" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Register & get my QR ticket</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export function Ticket({ eventId, refCode }: { eventId: string; refCode: string }) {
  const [t, setT] = useState<any>(null);
  const [err, setErr] = useState("");
  useEffect(() => { api(`/api/public/registrations/${refCode}`).then(setT).catch((e) => setErr(e.message)); }, [refCode]);
  if (err) return <p className="glass p-10 text-center text-white/60">{err}</p>;
  if (!t) return <div className="skeleton mx-auto h-96 max-w-md" />;
  return (
    <motion.div initial={{ opacity: 0, y: 30, rotate: -1 }} animate={{ opacity: 1, y: 0, rotate: 0 }} className="glass mx-auto max-w-md p-8 text-center">
      <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400" />
      <h1 className="mt-3 text-2xl font-black">You're registered!</h1>
      <p className="mt-1 text-sm text-white/55">{t.event?.title}</p>
      <div className="my-6 flex justify-center"><QrCode value={`YAYA-REG:${t.reference}`} size={240} /></div>
      <p className="text-xs uppercase tracking-widest text-white/45">Reference</p>
      <p className="font-mono text-2xl font-black tracking-wider text-accent">{t.reference}</p>
      <p className="mt-3 text-lg font-bold">{t.name}</p>
      {t.event?.startsAt && <p className="text-sm text-white/55">{new Date(t.event.startsAt).toLocaleString("en-NG", { dateStyle: "full", timeStyle: "short" })}</p>}
      <p className="mt-4 text-xs text-white/40">Screenshot this page or bookmark it. Show the QR code at the entrance.</p>
      <div className="mt-5 flex justify-center gap-2"><button className="btn btn-ghost btn-sm" onClick={() => window.print()}>Print</button><Link href={`/events/${eventId}`} className="btn btn-ghost btn-sm">Event details</Link></div>
    </motion.div>
  );
}

export function Attend({ token }: { token: string }) {
  const toast = useToast();
  const [info, setInfo] = useState<any>(null);
  const [err, setErr] = useState("");
  const [mode, setMode] = useState<"member" | "visitor">("member");
  const [f, setF] = useState({ identifier: "", name: "", phone: "" });
  const [useLoc, setUseLoc] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<any>(null);
  useEffect(() => { api(`/api/public/attend/${token}`).then(setInfo).catch((e) => setErr(e.message)); }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try {
      let pos: { lat?: number; lng?: number } = {};
      if (useLoc && navigator.geolocation) {
        pos = await new Promise((res) => navigator.geolocation.getCurrentPosition((p) => res({ lat: p.coords.latitude, lng: p.coords.longitude }), () => res({}), { timeout: 8000, maximumAge: 30000 }));
      }
      const r = await api(`/api/public/attend/${token}`, { method: "POST", json: { mode, ...(mode === "member" ? { identifier: f.identifier } : { name: f.name, phone: f.phone }), ...pos } });
      setDone(r);
    } catch (er: any) { toast.err(er.message); }
    setBusy(false);
  }

  if (err) return <p className="glass mx-auto max-w-md p-10 text-center text-white/60">{err}</p>;
  if (!info) return <div className="skeleton mx-auto h-80 max-w-md" />;
  if (done) return (
    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="glass mx-auto max-w-md p-10 text-center">
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.15 }}><CheckCircle2 className="mx-auto h-16 w-16 text-emerald-400" /></motion.div>
      <h1 className="mt-4 text-2xl font-black">Welcome, {done.name.split(" ")[0]}!</h1>
      <p className="mt-2 text-white/60">Your attendance for <b>{info.title}</b> is recorded.</p>
      <p className="mt-1 text-xs text-white/40">{new Date(done.at).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })}</p>
    </motion.div>
  );
  const open = info.state === "open";
  return (
    <div className="glass mx-auto max-w-md p-7">
      <p className="text-xs font-bold uppercase tracking-widest text-accent">Attendance</p>
      <h1 className="mt-1 text-2xl font-black">{info.title}</h1>
      {info.where && <p className="mt-1 text-sm text-white/50">{info.where}</p>}
      {!open ? <p className="mt-5 rounded-xl bg-white/5 p-4 text-sm text-white/65">{info.state === "scheduled" ? `Attendance opens at ${new Date(info.opensAt).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })}.` : "Attendance for this session is closed."}</p> : (
        <form onSubmit={submit} className="mt-5 space-y-4">
          <div className="glass grid grid-cols-2 gap-1 p-1">{(["member", "visitor"] as const).map((m) => <button type="button" key={m} onClick={() => setMode(m)} className={cn("relative rounded-xl py-2 text-sm font-semibold capitalize", mode === m ? "text-[#04130d]" : "text-white/60")}>{mode === m && <motion.span layoutId="att" className="absolute inset-0 rounded-xl bg-brand" />}<span className="relative">{m === "member" ? "I'm a member" : "I'm a visitor"}</span></button>)}</div>
          {mode === "member" ? (
            <div><label className="label">Member ID or registered phone</label><input className="input text-lg" required autoFocus value={f.identifier} onChange={(e) => setF({ ...f, identifier: e.target.value })} placeholder="YM-XXXXXX or 0803…" /></div>
          ) : (<>
            <div><label className="label">Full name</label><input className="input" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
            <div><label className="label">Phone</label><input className="input" type="tel" required value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
          </>)}
          {info.wantsLocation && <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-white/5 p-3 text-xs text-white/60"><input type="checkbox" className="mt-0.5 h-4 w-4 accent-emerald-500" checked={useLoc} onChange={(e) => setUseLoc(e.target.checked)} />Share my location to confirm I'm at the venue (optional; used only for this check).</label>}
          <button className="btn btn-primary w-full py-3.5 text-base" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Mark me present</button>
        </form>
      )}
    </div>
  );
}
