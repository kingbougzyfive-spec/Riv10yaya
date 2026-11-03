"use client";
import { motion } from "framer-motion";
import { CalendarCheck, Check, IdCard, Loader2, LogOut } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { QrCode } from "@/components/Qr";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/fetcher";

export function MemberPortal() {
  const toast = useToast();
  const router = useRouter();
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState("");
  const [f, setF] = useState({ name: "", email: "" });
  const [busy, setBusy] = useState(false);
  useEffect(() => { api("/api/me").then((r) => { setD(r); setF({ name: r.profile.name, email: r.profile.email ?? "" }); }).catch((e) => setErr(e.message)); }, []);
  if (err) return <p className="glass mx-auto max-w-lg p-8 text-center text-white/60">{err}</p>;
  if (!d) return <div className="mx-auto max-w-4xl space-y-4"><div className="skeleton h-48" /><div className="skeleton h-48" /></div>;
  const p = d.profile;
  const save = async () => { setBusy(true); try { await api("/api/me", { method: "PATCH", json: f }); toast.ok("Profile updated"); } catch (e: any) { toast.err(e.message); } setBusy(false); };
  return (
    <div className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-[340px_1fr]">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass space-y-4 p-6 text-center">
        <IdCard className="mx-auto h-6 w-6 text-accent" />
        <div><p className="text-lg font-black">{p.name}</p><p className="text-xs text-white/50">{[p.zone, p.area, p.parish].filter(Boolean).join(" → ")}</p></div>
        <div className="flex justify-center"><QrCode value={p.memberId} size={160} /></div>
        <p className="font-mono text-xl font-black tracking-widest text-accent">{p.memberId}</p>
        <p className="text-xs text-white/40">Use this ID (or your phone number) on any attendance page.</p>
        <button className="btn btn-ghost btn-sm" onClick={async () => { await api("/api/auth/logout", { method: "POST" }); router.push("/"); router.refresh(); }}><LogOut className="h-3.5 w-3.5" />Sign out</button>
      </motion.div>
      <div className="space-y-5">
        <div className="glass p-5">
          <p className="mb-3 font-bold">My details</p>
          <div className="grid gap-3 sm:grid-cols-2"><div><label className="label">Name</label><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div><div><label className="label">Email</label><input className="input" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div></div>
          <button className="btn btn-primary mt-4" disabled={busy} onClick={save}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Save</button>
        </div>
        <div className="glass p-5"><p className="mb-3 flex items-center gap-2 font-bold"><CalendarCheck className="h-4 w-4 text-accent" />My events</p>
          <div className="space-y-2">{d.events.map((e: any) => <Link key={e.id} href={`/events/${e.eventId}/ticket/${e.reference}`} className="glass-hover flex items-center justify-between gap-3 rounded-xl bg-white/5 p-3 text-sm"><span className="min-w-0"><b className="block truncate">{e.title}</b><span className="text-xs text-white/45">{e.startsAt ? new Date(e.startsAt).toLocaleDateString("en-NG", { dateStyle: "medium" }) : ""}</span></span><span className={`badge ${e.attended ? "badge-ok" : ""}`}>{e.attended ? "Attended" : "View ticket"}</span></Link>)}{d.events.length === 0 && <p className="text-sm text-white/45">You haven't registered for any events yet. <Link className="text-brand underline" href="/events">Browse events</Link></p>}</div></div>
        <div className="glass p-5"><p className="mb-3 font-bold">My attendance</p>
          <ul className="space-y-1.5 text-sm">{d.attendance.map((a: any) => <li key={a.id} className="flex justify-between gap-3 rounded-lg bg-white/5 px-3 py-2"><span className="truncate">{a.title}</span><span className="shrink-0 text-xs text-white/45">{new Date(a.at).toLocaleDateString("en-NG", { dateStyle: "medium" })}</span></li>)}{d.attendance.length === 0 && <li className="text-white/45">No attendance recorded yet.</li>}</ul></div>
      </div>
    </div>
  );
}
