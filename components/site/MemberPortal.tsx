"use client";
import { motion } from "framer-motion";
import { Bell, CalendarCheck, Check, HeartHandshake, IdCard, Loader2, LogOut, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { QrCode } from "@/components/Qr";
import { ChangePassword } from "@/components/ChangePassword";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/fetcher";

const fmt = (v?: string) => (v ? new Date(v).toLocaleDateString("en-NG", { dateStyle: "medium" }) : "");

export function MemberPortal() {
  const toast = useToast();
  const router = useRouter();
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState("");
  const [f, setF] = useState({ name: "", email: "", phone: "", currentPassword: "" });
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState<any>(null);
  const [open, setOpen] = useState<any[] | null>(null);
  const [reg, setReg] = useState<any>(null);
  const [ans, setAns] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    api("/api/me").then((r) => { setD(r); setF({ name: r.profile.name, email: r.profile.email ?? "", phone: r.profile.phone ?? "", currentPassword: "" }); }).catch((e) => setErr(e.message));
    api("/api/notifications").then(setNotes).catch(() => {});
    api("/api/me/register").then((r) => setOpen(r.events)).catch(() => setOpen([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  if (err) return <p className="glass mx-auto max-w-lg p-8 text-center text-white/60">{err}</p>;
  if (!d) return <div className="mx-auto max-w-4xl space-y-4"><div className="skeleton h-48" /><div className="skeleton h-48" /></div>;
  const p = d.profile;
  const phoneChanged = f.phone.replace(/\D/g, "") !== (p.phone ?? "").replace(/\D/g, "");
  const save = async () => { setBusy(true); try { await api("/api/me", { method: "PATCH", json: { name: f.name, email: f.email, ...(phoneChanged ? { phone: f.phone, currentPassword: f.currentPassword } : {}) } }); toast.ok("Profile updated"); load(); } catch (e: any) { toast.err(e.message); } setBusy(false); };
  const pref = async (k: "email" | "sms" | "push", v: boolean) => { setD({ ...d, prefs: { ...d.prefs, [k]: v } }); try { await api("/api/me", { method: "PATCH", json: { prefs: { [k]: v } } }); } catch (e: any) { toast.err(e.message); load(); } };
  const doReg = async () => { setBusy(true); try { const r = await api("/api/me/register", { method: "POST", json: { eventId: reg.id, answers: ans } }); toast.ok(`You're registered for ${r.title}`); setReg(null); setAns({}); load(); } catch (e: any) { toast.err(e.message); } setBusy(false); };
  const read = async () => { await api("/api/notifications", { method: "PATCH", json: { all: true } }).catch(() => {}); api("/api/notifications").then(setNotes).catch(() => {}); };

  return (
    <div className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-[340px_1fr]">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass h-fit space-y-4 p-6 text-center">
        <IdCard className="mx-auto h-6 w-6 text-accent" />
        <div><p className="text-lg font-black">{p.name}</p><p className="text-xs text-white/50">{[p.zone, p.area, p.parish].filter(Boolean).join(" → ")}</p></div>
        <div className="flex justify-center"><QrCode value={p.memberId} size={160} /></div>
        <p className="font-mono text-xl font-black tracking-widest text-accent">{p.memberId}</p>
        <p className="text-xs text-white/40">Use this ID (or your phone number) on any attendance page.</p>
        <dl className="space-y-1 border-t border-white/10 pt-3 text-left text-sm">
          <div className="flex justify-between"><dt className="text-white/50">Category</dt><dd>{p.category}</dd></div>
          <div className="flex justify-between"><dt className="text-white/50">Status</dt><dd className="capitalize">{p.status}</dd></div>
          <div className="flex justify-between"><dt className="text-white/50">Joined</dt><dd>{fmt(p.joinedAt)}</dd></div>
          {p.departments.length > 0 && <div className="flex justify-between gap-3"><dt className="text-white/50">Departments</dt><dd className="text-right">{p.departments.join(", ")}</dd></div>}
          {p.leadership && <div className="flex justify-between"><dt className="text-white/50">Role</dt><dd>{p.leadership.title}</dd></div>}
        </dl>
        <button className="btn btn-ghost btn-sm" onClick={async () => { await api("/api/auth/logout", { method: "POST" }); router.push("/"); router.refresh(); }}><LogOut className="h-3.5 w-3.5" />Sign out</button>
      </motion.div>

      <div className="space-y-5">
        {p.minor && <div className="glass flex items-start gap-3 p-4 text-sm"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-accent" /><p>{p.guardian?.verified ? "Your parent or guardian's consent is confirmed." : "Your parish administrator still needs to confirm your parent or guardian's consent. You can register for events once that is done."}</p></div>}

        <div className="glass p-5">
          <p className="mb-1 font-bold">My details</p>
          <p className="mb-3 text-xs text-white/50">Your parish, category and status are managed by your parish administrator. Only you and authorised administrators of your own parish, area or zone can see these details.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="label">Name</label><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
            <div><label className="label">Email</label><input className="input" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
            <div><label className="label">Phone</label><input className="input" type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
            {phoneChanged && <div><label className="label">Current password</label><input className="input" type="password" autoComplete="current-password" value={f.currentPassword} onChange={(e) => setF({ ...f, currentPassword: e.target.value })} /><p className="hint">Needed to change your phone number.</p></div>}
          </div>
          <button className="btn btn-primary mt-4" disabled={busy} onClick={save}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Save</button>
        </div>

        <div className="glass p-5">
          <div className="mb-3 flex items-center justify-between"><p className="flex items-center gap-2 font-bold"><Bell className="h-4 w-4 text-accent" />Notifications{notes?.unread > 0 && <span className="badge badge-warn">{notes.unread} new</span>}</p>{notes?.unread > 0 && <button className="btn btn-ghost btn-sm" onClick={read}>Mark all read</button>}</div>
          <ul className="space-y-1.5 text-sm">{notes?.rows.slice(0, 6).map((n: any) => <li key={n.id}><Link href={n.link || "#"} className={`block rounded-lg px-3 py-2 ${n.read ? "bg-white/5" : "bg-brand/10"}`}><b>{n.title}</b>{n.body && <span className="block text-xs text-white/55">{n.body}</span>}</Link></li>)}{!notes?.rows.length && <li className="text-white/45">No notifications yet.</li>}</ul>
          <div className="mt-4 border-t border-white/10 pt-3"><p className="mb-2 text-sm font-semibold">How should we reach you?</p><p className="mb-2 text-xs text-white/50">In-app notices are always on. Choose the extras you want.</p>
            <div className="flex flex-wrap gap-4 text-sm">{([["email", "Email"], ["sms", "SMS"], ["push", "Push on this device"]] as const).map(([k, l]) => <label key={k} className="flex items-center gap-2"><input type="checkbox" checked={d.prefs[k]} onChange={(e) => pref(k, e.target.checked)} />{l}</label>)}</div></div>
        </div>

        <div className="glass p-5">
          <p className="mb-3 flex items-center gap-2 font-bold"><CalendarCheck className="h-4 w-4 text-accent" />Events open for registration</p>
          <div className="space-y-2">{open?.map((e) => <div key={e.id} className="flex items-center justify-between gap-3 rounded-xl bg-white/5 p-3 text-sm"><span className="min-w-0"><b className="block truncate">{e.title}</b><span className="text-xs text-white/45">{fmt(e.startsAt)}{e.venue ? ` · ${e.venue}` : ""}</span></span>{e.reference ? <Link className="badge badge-ok" href={`/events/${e.id}/ticket/${e.reference}`}>Registered · ticket</Link> : <button className="btn btn-primary btn-sm" onClick={() => { setReg(e); setAns({}); }}>Register</button>}</div>)}{open?.length === 0 && <p className="text-sm text-white/45">No events are open right now. <Link className="text-brand underline" href="/events">See all events</Link></p>}</div>
        </div>

        <div className="glass p-5"><p className="mb-3 font-bold">My events</p>
          <div className="space-y-2">{d.events.map((e: any) => <Link key={e.id} href={`/events/${e.eventId}/ticket/${e.reference}`} className="glass-hover flex items-center justify-between gap-3 rounded-xl bg-white/5 p-3 text-sm"><span className="min-w-0"><b className="block truncate">{e.title}</b><span className="text-xs text-white/45">{fmt(e.startsAt)}</span></span><span className={`badge ${e.attended ? "badge-ok" : ""}`}>{e.attended ? "Attended" : "View ticket"}</span></Link>)}{d.events.length === 0 && <p className="text-sm text-white/45">You haven't registered for any events yet.</p>}</div></div>

        <div className="glass p-5"><p className="mb-3 font-bold">My attendance</p>
          <ul className="space-y-1.5 text-sm">{d.attendance.map((a: any) => <li key={a.id} className="flex justify-between gap-3 rounded-lg bg-white/5 px-3 py-2"><span className="truncate">{a.title}</span><span className="shrink-0 text-xs text-white/45">{fmt(a.at)}</span></li>)}{d.attendance.length === 0 && <li className="text-white/45">No attendance recorded yet.</li>}</ul></div>

        {d.volunteer.length > 0 && <div className="glass p-5"><p className="mb-3 flex items-center gap-2 font-bold"><HeartHandshake className="h-4 w-4 text-accent" />My service</p><ul className="space-y-1.5 text-sm">{d.volunteer.map((v: any) => <li key={v.id} className="flex justify-between gap-3 rounded-lg bg-white/5 px-3 py-2"><span>{v.title}{v.hours ? ` · ${v.hours}h` : ""}</span><span className="text-xs text-white/45">{fmt(v.at)}</span></li>)}</ul></div>}
        <ChangePassword />
      </div>

      <Modal open={!!reg} onClose={() => setReg(null)} title={reg ? `Register: ${reg.title}` : ""}>
        {reg && <div className="space-y-4">
          <p className="text-sm text-white/65">We'll use the details on your profile: {p.name}, {p.phone}.</p>
          {reg.customFields.map((c: any) => <div key={c.key}><label className="label">{c.label}{c.required ? " *" : ""}</label>{c.type === "select" ? <select className="input" value={ans[c.key] ?? ""} onChange={(e) => setAns({ ...ans, [c.key]: e.target.value })}><option value="">Select…</option>{c.options.map((o: string) => <option key={o}>{o}</option>)}</select> : c.type === "yesno" ? <select className="input" value={ans[c.key] ?? ""} onChange={(e) => setAns({ ...ans, [c.key]: e.target.value })}><option value="">Select…</option><option>Yes</option><option>No</option></select> : <input className="input" value={ans[c.key] ?? ""} onChange={(e) => setAns({ ...ans, [c.key]: e.target.value })} />}</div>)}
          <button className="btn btn-primary w-full py-3" disabled={busy} onClick={doReg}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Confirm registration</button>
        </div>}
      </Modal>
    </div>
  );
}
