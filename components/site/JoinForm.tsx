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
  const [f, setF] = useState({ name: "", phone: "", email: "", password: "", zone: "", area: "", parish: "" });
  const [busy, setBusy] = useState(false);
  useEffect(() => { api("/api/public/org").then(setOrg).catch(() => {}); }, []);
  const zone = org?.zones.find((z: any) => z.id === f.zone);
  const parishes = org?.parishes.filter((p: any) => p.zone === f.zone && (zone?.hasAreas ? p.area === f.area : true)) ?? [];
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try { await api("/api/public/join", { method: "POST", json: { name: f.name, phone: f.phone, email: f.email, password: f.password, parish: f.parish } }); toast.ok("Welcome! Your account is ready."); router.push("/me"); router.refresh(); }
    catch (er: any) { toast.err(er.message); setBusy(false); }
  }
  return (
    <form onSubmit={submit} className="glass mx-auto max-w-lg space-y-4 p-6 sm:p-8">
      <div className="grid gap-4 sm:grid-cols-2"><div><label className="label">Full name</label><input className="input" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div><div><label className="label">Phone</label><input className="input" type="tel" required value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div></div>
      <div><label className="label">Email</label><input className="input" type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
      <div><label className="label">Password</label><input className="input" type="password" minLength={10} required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /><p className="hint">At least 10 characters.</p></div>
      {org && (<>
        <div><label className="label">Zone</label><select className="input" required value={f.zone} onChange={(e) => setF({ ...f, zone: e.target.value, area: "", parish: "" })}><option value="">Select zone…</option>{org.zones.map((z: any) => <option key={z.id} value={z.id}>{z.name}</option>)}</select></div>
        {zone?.hasAreas && <div><label className="label">Area</label><select className="input" required value={f.area} onChange={(e) => setF({ ...f, area: e.target.value, parish: "" })}><option value="">Select area…</option>{org.areas.filter((a: any) => a.zone === f.zone).map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>}
        {zone && (!zone.hasAreas || f.area) && <div><label className="label">Parish</label><select className="input" required value={f.parish} onChange={(e) => setF({ ...f, parish: e.target.value })}><option value="">Select parish…</option>{parishes.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>}
      </>)}
      <button className="btn btn-primary w-full py-3" disabled={busy || !f.parish}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}Create my account</button>
    </form>
  );
}
