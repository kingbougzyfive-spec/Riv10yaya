"use client";
import { Loader2, Mail } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AuthShell } from "@/components/AuthShell";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/fetcher";

export default function ForgotPage() {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<null | { emailConfigured: boolean }>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try { setDone(await api("/api/auth/forgot", { method: "POST", json: { email } })); } catch (er: any) { toast.err(er.message); }
    setBusy(false);
  }
  return (
    <AuthShell title="Forgot your password?" subtitle="We'll email you a link to choose a new one.">
      {done ? (
        <div className="space-y-4 text-sm text-white/70">
          {done.emailConfigured ? <p>If that email has an account, a reset link is on its way. It expires in 1 hour.</p> : <p className="badge-warn rounded-xl p-3">Email sending isn't set up yet. Please ask the Super Administrator to reset your password from Users & Roles.</p>}
          <Link href="/login" className="btn btn-ghost w-full">Back to sign in</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div><label className="label">Email</label><input className="input" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <button className="btn btn-primary w-full py-3" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}Send reset link</button>
          <p className="text-center text-xs text-white/40"><Link href="/login" className="hover:text-white">← Back to sign in</Link></p>
        </form>
      )}
    </AuthShell>
  );
}
