"use client";
import { Loader2, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/fetcher";

export function JoinForm() {
  const toast = useToast();
  const router = useRouter();
  const [org, setOrg] = useState<any>(null);
  const [f, setF] = useState({ name: "", phone: "", email: "", password: "", zone: "", area: "", parish: "", dob: "", memberId: "", privacy: false, gName: "", gPhone: "", gRel: "", gConsent: false });
  const [busy, setBusy] = useState(false);
  useEffect(() => { api("/api/public/org").then(setOrg).catch(() => {}); }, []);
  const minor = !!f.dob && (Date.now() - new Date(f.dob).getTime()) / 31_557_600_000 < 18;
  const zone = org?.zones.find((z: any) => z.id === f.zone);
  const parishes = org?.parishes.filter((p: any) => p.zone === f.zone && (zone?.hasAreas ? p.area === f.area : true)) ?? [];
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try { await api("/api/public/join", { method: "POST", json: { name: f.name, phone: f.phone, email: f.email, password: f.password, parish: f.parish, dob: f.dob, memberId: f.memberId, privacy: f.privacy, ...(minor ? { guardian: { name: f.gName, phone: f.gPhone, relationship: f.gRel }, guardianConsent: f.gConsent } : {}) } }); toast.ok("Welcome! Your account is ready."); router.push("/member"); router.refresh(); }
    catch (er: any) { toast.err(er.message); setBusy(false); }
  }
  return (
    <form onSubmit={submit} className="glass mx-auto max-w-lg space-y-4 p-6 sm:p-8">
      <div className="grid gap-4 sm:grid-cols-2"><div><label className="label">Full name</label><input className="input" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div><div><label className="label">Phone</label><input className="input" type="tel" required value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div></div>
      <div><label className="label">Email</label><input className="input" type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
      <div><label className="label">Password</label><input className="input" type="password" minLength={10} required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /><p className="hint">At least 10 characters.</p></div>
      <div><label className="label">Date of birth</label><input className="input" type="date" required max={new Date().toISOString().slice(0, 10)} value={f.dob} onChange={(e) => setF({ ...f, dob: e.target.value })} /></div>
      <div><label className="label">Member ID <span className="font-normal text-white/40">(only if your parish already registered you)</span></label><input className="input font-mono uppercase" placeholder="YM-XXXXXX" value={f.memberId} onChange={(e) => setF({ ...f, memberId: e.target.value })} /></div>
      {minor && (
        <div className="space-y-3 rounded-2xl border border-accent/40 bg-accent/10 p-4">
          <p className="text-sm font-semibold">You are under 18, so a parent or guardian must agree.</p>
          <input className="input" required placeholder="Parent / guardian full name" value={f.gName} onChange={(e) => setF({ ...f, gName: e.target.value })} />
          <div className="grid gap-3 sm:grid-cols-2"><input className="input" type="tel" required placeholder="Their phone" value={f.gPhone} onChange={(e) => setF({ ...f, gPhone: e.target.value })} /><input className="input" required placeholder="Relationship (e.g. Mother)" value={f.gRel} onChange={(e) => setF({ ...f, gRel: e.target.value })} /></div>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" required checked={f.gConsent} onChange={(e) => setF({ ...f, gConsent: e.target.checked })} />My parent or guardian has agreed to me joining. Your parish administrator will confirm this with them.</label>
        </div>
      )}
      {org && (<>
        <div><label className="label">Zone</label><select className="input" required value={f.zone} onChange={(e) => setF({ ...f, zone: e.target.value, area: "", parish: "" })}><option value="">Select zone…</option>{org.zones.map((z: any) => <option key={z.id} value={z.id}>{z.name}</option>)}</select></div>
        {zone?.hasAreas && <div><label className="label">Area</label><select className="input" required value={f.area} onChange={(e) => setF({ ...f, area: e.target.value, parish: "" })}><option value="">Select area…</option>{org.areas.filter((a: any) => a.zone === f.zone).map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>}
        {zone && (!zone.hasAreas || f.area) && <div><label className="label">Parish</label><select className="input" required value={f.parish} onChange={(e) => setF({ ...f, parish: e.target.value })}><option value="">Select parish…</option>{parishes.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>}
      </>)}
      <label className="flex items-start gap-2 text-sm text-white/70"><input type="checkbox" className="mt-1" required checked={f.privacy} onChange={(e) => setF({ ...f, privacy: e.target.checked })} />I agree that my parish and church administrators may keep and use my details to run church activities. Only authorised administrators in my own parish, area or zone can see them.</label>
      <button className="btn btn-primary w-full py-3" disabled={busy || !f.parish || !f.privacy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}Create my account</button>
    </form>
  );
}
