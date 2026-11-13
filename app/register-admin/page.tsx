"use client";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AuthShell } from "@/components/AuthShell";
import { useToast } from "@/components/ui/Toast";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { api } from "@/lib/fetcher";

type Level = "zone" | "area" | "parish";
const LEVELS: { v: Level; label: string }[] = [{ v: "zone", label: "Zone" }, { v: "area", label: "Area" }, { v: "parish", label: "Parish" }];
const byName = (a: any, b: any) => String(a.name).localeCompare(String(b.name), undefined, { numeric: true, sensitivity: "base" });

export default function RegisterAdminPage() {
  const toast = useToast();
  const [org, setOrg] = useState<any>(null);
  const [f, setF] = useState({ name: "", email: "", phone: "", password: "", level: "parish" as Level, zone: "", area: "", parish: "" });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => { api("/api/public/org").then(setOrg).catch(() => setOrg({ zones: [], areas: [], parishes: [], failed: true })); }, []);
  const set = (patch: Partial<typeof f>) => setF((s) => ({ ...s, ...patch }));

  // Everyone picks from the lists the Super Administrator maintains.
  const allZones: any[] = [...(org?.zones ?? [])].sort(byName);
  const zones = f.level === "area" ? allZones.filter((z) => z.hasAreas) : allZones;
  const zone = allZones.find((z) => z.id === f.zone);
  const needsArea = f.level === "area" || (f.level === "parish" && !!zone?.hasAreas);
  const areas: any[] = org && zone?.hasAreas ? org.areas.filter((a: any) => a.zone === zone.id).sort(byName) : [];
  const parishes: any[] = org && f.zone ? org.parishes.filter((p: any) => p.zone === f.zone && (zone?.hasAreas ? p.area === f.area : true)).sort(byName) : [];
  const empty = org && zones.length === 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/api/public/admin-request", { method: "POST", json: { name: f.name, email: f.email, phone: f.phone, password: f.password, level: f.level, zone: f.zone, area: needsArea ? f.area : "", parish: f.level === "parish" ? f.parish : "" } });
      setDone(true);
    } catch (er: any) { toast.err(er.message); }
    setBusy(false);
  }

  if (done) return (
    <AuthShell title="Request sent" subtitle="Thank you. The Super Administrator will review it.">
      <div className="space-y-4 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" aria-hidden="true" />
        <p className="text-sm text-white/75">Once it is approved you can sign in with the email and password you just chose. Until then, signing in will tell you it is still waiting.</p>
        <Link href="/login" className="btn btn-primary w-full py-3">Go to sign in</Link>
      </div>
    </AuthShell>
  );

  return (
    <AuthShell wide title="Register as an administrator" subtitle="For zone, area and parish leaders. Your request is checked before your account is created.">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label">Full name</label><input className="input" required autoComplete="name" value={f.name} onChange={(e) => set({ name: e.target.value })} /></div>
          <div><label className="label">Phone</label><input className="input" required inputMode="tel" autoComplete="tel" value={f.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="0803 000 0000" /></div>
        </div>
        <div><label className="label">Email</label><input className="input" type="email" required autoComplete="email" value={f.email} onChange={(e) => set({ email: e.target.value })} /></div>
        <div><label className="label">Password</label><PasswordInput className="input" required minLength={10} autoComplete="new-password" value={f.password} onChange={(e) => set({ password: e.target.value })} /><p className="mt-1 text-xs text-white/65">At least 10 characters, with letters and numbers.</p></div>

        <fieldset>
          <legend className="label">What do you lead?</legend>
          <div className="grid grid-cols-3 gap-2" role="radiogroup">
            {LEVELS.map((l) => (
              <button type="button" key={l.v} role="radio" aria-checked={f.level === l.v} onClick={() => set({ level: l.v, zone: "", area: "", parish: "" })}
                className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${f.level === l.v ? "border-brand bg-brand/20 text-white" : "border-white/15 text-white/75 hover:bg-white/5"}`}>{l.label}</button>
            ))}
          </div>
        </fieldset>

        <div>
          <label className="label">{f.level === "zone" ? "Select your zone" : "Zone"}</label>
          <select className="input" required value={f.zone} onChange={(e) => set({ zone: e.target.value, area: "", parish: "" })}>
            <option value="">{org ? "Select your zone…" : "Loading…"}</option>
            {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
          {empty && <p className="mt-1 text-xs text-amber-300">{org.failed ? "Couldn't load the list. Refresh and try again." : f.level === "area" ? "No zone with areas has been set up yet. Please try again later." : "Zones are still being added. Please try again later."}</p>}
        </div>
        {needsArea && f.zone && (
          <div>
            <label className="label">{f.level === "area" ? "Select your area" : "Area"}</label>
            <select className="input" required value={f.area} onChange={(e) => set({ area: e.target.value, parish: "" })}>
              <option value="">Select your area…</option>
              {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            {areas.length === 0 && <p className="mt-1 text-xs text-amber-300">No areas have been added to this zone yet. Please try again later.</p>}
          </div>
        )}
        {f.level === "parish" && f.zone && (!needsArea || f.area) && (
          <div>
            <label className="label">Select your parish</label>
            <select className="input" required value={f.parish} onChange={(e) => set({ parish: e.target.value })}>
              <option value="">Select your parish…</option>
              {parishes.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {parishes.length === 0 && <p className="mt-1 text-xs text-amber-300">No parishes have been added here yet. Please try again later.</p>}
          </div>
        )}

        <button className="btn btn-primary w-full py-3" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Send my request</button>
        <p className="text-center text-xs text-white/65">Parish administrators submit the monthly remittance and report. Zone and area administrators submit their own report and follow their parishes.</p>
        <p className="text-center text-xs text-white/65"><Link href="/login" className="text-brand hover:underline">Already approved? Sign in</Link></p>
      </form>
    </AuthShell>
  );
}
