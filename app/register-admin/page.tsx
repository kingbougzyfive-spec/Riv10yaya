"use client";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AuthShell } from "@/components/AuthShell";
import { useToast } from "@/components/ui/Toast";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { api } from "@/lib/fetcher";

type Level = "zone" | "area" | "parish";
const LEVELS: { v: Level; label: string }[] = [{ v: "zone", label: "Zone" }, { v: "area", label: "Area" }, { v: "parish", label: "Parish" }];
const byLabel = (a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: "base" });

export default function RegisterAdminPage() {
  const toast = useToast();
  const [org, setOrg] = useState<any>(null);
  const [f, setF] = useState({ name: "", email: "", phone: "", password: "", level: "parish" as Level, unit: "" });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => { api("/api/public/org").then(setOrg).catch(() => setOrg({ zones: [], areas: [], parishes: [], failed: true })); }, []);
  const set = (patch: Partial<typeof f>) => setF((s) => ({ ...s, ...patch }));

  // One list that matches the button chosen: zones, areas or parishes. Choosing is optional.
  const options = useMemo((): { id: string; label: string }[] => {
    if (!org) return [];
    const zn = (id: string) => org.zones.find((z: any) => z.id === id)?.name ?? "";
    const an = (id: string | null) => (id ? org.areas.find((a: any) => a.id === id)?.name ?? "" : "");
    if (f.level === "zone") return org.zones.map((z: any) => ({ id: z.id, label: z.name })).sort(byLabel);
    if (f.level === "area") return org.areas.map((a: any) => ({ id: a.id, label: `${a.name} (${zn(a.zone)})` })).sort(byLabel);
    return org.parishes.map((p: any) => ({ id: p.id, label: `${p.name} (${[an(p.area), zn(p.zone)].filter(Boolean).join(", ")})` })).sort(byLabel);
  }, [org, f.level]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/api/public/admin-request", { method: "POST", json: { name: f.name, email: f.email, phone: f.phone, password: f.password, level: f.level, unit: f.unit } });
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
              <button type="button" key={l.v} role="radio" aria-checked={f.level === l.v} onClick={() => set({ level: l.v, unit: "" })}
                className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${f.level === l.v ? "border-brand bg-brand/20 text-white" : "border-white/15 text-white/75 hover:bg-white/5"}`}>{l.label}</button>
            ))}
          </div>
        </fieldset>

        <div>
          <label className="label">Select your {f.level} <span className="font-normal text-white/65">(optional)</span></label>
          <select className="input" value={f.unit} onChange={(e) => set({ unit: e.target.value })}>
            <option value="">{org ? `Not sure yet. I'll tell the administrator` : "Loading…"}</option>
            {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
          {org?.failed && <p className="mt-1 text-xs text-amber-300">Couldn't load the list. You can still send your request without choosing.</p>}
          <p className="mt-1 text-xs text-white/65">Choosing it speeds up approval. If you leave it blank, the Super Administrator will assign it.</p>
        </div>

        <button className="btn btn-primary w-full py-3" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Send my request</button>
        <p className="text-center text-xs text-white/65">Parish administrators submit the monthly remittance and report. Zone and area administrators submit their own report and follow their parishes.</p>
        <p className="text-center text-xs text-white/65"><Link href="/login" className="text-brand hover:underline">Already approved? Sign in</Link></p>
      </form>
    </AuthShell>
  );
}
