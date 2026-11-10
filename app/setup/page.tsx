"use client";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Database, Loader2, ShieldCheck, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthShell } from "@/components/AuthShell";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/fetcher";

export default function SetupPage() {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [loading, setLoading] = useState(true);
  const [uri, setUri] = useState("");
  const [label, setLabel] = useState("Primary");
  const [tested, setTested] = useState<null | { ok: boolean; latencyMs?: number; error?: string }>(null);
  const [busy, setBusy] = useState(false);
  const [admin, setAdmin] = useState({ name: "", email: "", password: "" });
  const [needsToken, setNeedsToken] = useState(false);
  const [token, setToken] = useState("");

  useEffect(() => {
    api("/api/setup").then((s) => {
      setNeedsToken(!!s.needsToken);
      if ((s.hasDb && s.hasUsers) || (s.hasDb && s.bootstrap && !s.dbError)) router.replace("/login");
      else if (s.hasDb && !s.dbError) setStep(1);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [router]);

  async function test() {
    setBusy(true);
    try { setTested(await api("/api/setup", { method: "POST", json: { action: "connect", uri, label, test: true, token } })); }
    catch (e: any) { toast.err(e.message); }
    setBusy(false);
  }
  async function connect() {
    setBusy(true);
    try { await api("/api/setup", { method: "POST", json: { action: "connect", uri, label, token } }); toast.ok("Database connected"); setStep(1); }
    catch (e: any) { toast.err(e.message); }
    setBusy(false);
  }
  async function createAdmin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try { await api("/api/setup", { method: "POST", json: { action: "create_admin", ...admin, token } }); setStep(2); setTimeout(() => { router.push("/admin"); router.refresh(); }, 1400); }
    catch (e: any) { toast.err(e.message); setBusy(false); }
  }

  if (loading) return <AuthShell title="Getting ready…"><div className="skeleton h-24" /></AuthShell>;

  return (
    <AuthShell wide title="Let's set up your platform" subtitle="Two quick steps. You can add backup databases later from Admin → Database.">
      <div className="mb-6 flex items-center gap-2">
        {["Database", "Super Admin", "Done"].map((s, i) => (
          <div key={s} className="flex flex-1 items-center gap-2">
            <div className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold transition ${i <= step ? "bg-brand text-[#04130d]" : "bg-white/10 text-white/50"}`}>{i < step ? "✓" : i + 1}</div>
            <span className={`hidden text-xs sm:block ${i <= step ? "text-white" : "text-white/40"}`}>{s}</span>
            {i < 2 && <div className="h-px flex-1 bg-white/15" />}
          </div>
        ))}
      </div>
      <AnimatePresence mode="wait">
        {needsToken && step < 2 && (
          <div className="mb-4"><label className="label">Setup code</label><input className="input" type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} placeholder="From your SETUP_TOKEN setting" /></div>
        )}
        {step === 0 && (
          <motion.div key="s0" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} className="space-y-4">
            <div><label className="label">Connection name</label><input className="input" value={label} onChange={(e) => setLabel(e.target.value)} /></div>
            <div>
              <label className="label">MongoDB connection string</label>
              <textarea className="input min-h-[96px] font-mono text-xs" value={uri} onChange={(e) => { setUri(e.target.value); setTested(null); }} placeholder="mongodb+srv://user:password@cluster0.xxxxx.mongodb.net/yaya?retryWrites=true&w=majority" />
              <p className="hint">Find it in MongoDB Atlas → Connect → Drivers. Stored encrypted; never shown in full again.</p>
            </div>
            {tested && (
              <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={`rounded-xl p-3 text-sm ${tested.ok ? "badge-ok" : "badge-bad"}`}>
                {tested.ok ? `Connected in ${tested.latencyMs} ms. Looks good.` : tested.error}
              </motion.p>
            )}
            <div className="flex gap-3">
              <button className="btn btn-ghost flex-1" onClick={test} disabled={busy || uri.length < 10}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}Test</button>
              <button className="btn btn-primary flex-1" onClick={connect} disabled={busy || !tested?.ok}><Database className="h-4 w-4" />Save & continue</button>
            </div>
          </motion.div>
        )}
        {step === 1 && (
          <motion.form key="s1" onSubmit={createAdmin} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} className="space-y-4">
            <div><label className="label">Full name</label><input className="input" required value={admin.name} onChange={(e) => setAdmin({ ...admin, name: e.target.value })} /></div>
            <div><label className="label">Email</label><input className="input" type="email" required value={admin.email} onChange={(e) => setAdmin({ ...admin, email: e.target.value })} /></div>
            <div><label className="label">Password</label><input className="input" type="password" minLength={10} required value={admin.password} onChange={(e) => setAdmin({ ...admin, password: e.target.value })} /><p className="hint">At least 10 characters.</p></div>
            <button className="btn btn-primary w-full py-3" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}Create Super Administrator</button>
          </motion.form>
        )}
        {step === 2 && (
          <motion.div key="s2" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="py-6 text-center">
            <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-400" />
            <p className="mt-4 text-lg font-bold">All set!</p><p className="text-sm text-white/55">Opening your dashboard…</p>
          </motion.div>
        )}
      </AnimatePresence>
    </AuthShell>
  );
}
