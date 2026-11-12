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

export default function RegisterAdminPage() {
  const toast = useToast();
  const [org, setOrg] = useState<any>(null);
  const [f, setF] = useState({ name: "", email: "", phone: "", password: "", level: "parish" as Level, zoneName: "", areaName: "", parishName: "" });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  // Existing names are only offered as typing suggestions. People are free to type anything.
  useEffect(() => { api("/api/public/org").then(setOrg).catch(() => {}); }, []);
  const set = (patch: Partial<typeof f>) => setF((s) => ({ ...s, ...patch }));
  const key = (v: string) => v.trim().toLowerCase().replace(/\s+/g, " ");
  const zone = org?.zones.find((z: any) => key(z.name) === key(f.zoneName));
  const showArea = f.level === "area" || (f.level === "parish" && (!zone || zone.hasAreas));
  const zoneNames: string[] = org?.zones.map((z: any) => z.name) ?? [];
  const areaNames: string[] = org ? (zone ? org.areas.filter((a: any) => a.zone === zone.id) : org.areas).map((a: any) => a.name) : [];
  const parishNames: string[] = org ? org.parishes.filter((p: any) => (!zone || p.zone === zone.id)).map((p: any) => p.name) : [];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/api/public/admin-request", { method: "POST", json: {
        name: f.name, email: f.email, phone: f.phone, password: f.password, level: f.level,
        zoneName: f.zoneName, areaName: showArea ? f.areaName : "", parishName: f.level === "parish" ? f.parishName : "",
      } });
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
              <button type="button" key={l.v} role="radio" aria-checked={f.level === l.v} onClick={() => set({ level: l.v })}
                className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${f.level === l.v ? "border-brand bg-brand/20 text-white" : "border-white/15 text-white/75 hover:bg-white/5"}`}>{l.label}</button>
            ))}
          </div>
        </fieldset>

        <div><label className="label">Name of your zone</label><input className="input" required minLength={2} maxLength={80} list="zone-names" autoComplete="off" value={f.zoneName} onChange={(e) => set({ zoneName: e.target.value })} placeholder="e.g. Port Harcourt Zone 1" /></div>
        {showArea && (
          <div><label className="label">Name of your area{f.level === "parish" && <span className="font-normal text-white/65"> (leave blank if your zone has no areas)</span>}</label><input className="input" required={f.level === "area" || !!zone?.hasAreas} minLength={2} maxLength={80} list="area-names" autoComplete="off" value={f.areaName} onChange={(e) => set({ areaName: e.target.value })} /></div>
        )}
        {f.level === "parish" && (
          <div><label className="label">Name of your parish</label><input className="input" required minLength={2} maxLength={80} list="parish-names" autoComplete="off" value={f.parishName} onChange={(e) => set({ parishName: e.target.value })} /></div>
        )}
        <datalist id="zone-names">{zoneNames.map((n) => <option key={n} value={n} />)}</datalist>
        <datalist id="area-names">{areaNames.map((n) => <option key={n} value={n} />)}</datalist>
        <datalist id="parish-names">{parishNames.map((n) => <option key={n} value={n} />)}</datalist>

        <button className="btn btn-primary w-full py-3" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Send my request</button>
        <p className="text-center text-xs text-white/65">Parish administrators submit the monthly remittance and report. Zone and area administrators submit their own report and follow their parishes.</p>
        <p className="text-center text-xs text-white/65"><Link href="/login" className="text-brand hover:underline">Already approved? Sign in</Link></p>
      </form>
    </AuthShell>
  );
}
