"use client";
import { Loader2, LogIn } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthShell } from "@/components/AuthShell";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/fetcher";
import { PasswordInput } from "@/components/ui/PasswordInput";

export default function LoginPage() {
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api("/api/auth/login", { method: "POST", json: { email, password } });
      router.push(r.mustChange ? (r.role === "member" ? "/member?force=1" : "/admin/account?force=1") : r.role === "member" ? "/member" : r.role === "parish_admin" ? "/portal" : "/admin");
      router.refresh();
    } catch (err: any) {
      toast.err(err.message);
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to manage your organisation.">
      <form onSubmit={submit} className="space-y-4">
        <div><label className="label">Email</label><input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></div>
        <div><label className="label">Password</label><PasswordInput className="input" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        <button className="btn btn-primary w-full py-3" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}Sign in</button>
        <p className="text-center text-xs"><Link href="/forgot-password" className="text-white/65 hover:text-white">Forgot your password?</Link></p>
        <p className="text-center text-xs text-white/65"><Link href="/join" className="text-brand hover:underline">New member? Create an account</Link> · <Link href="/" className="hover:text-white">← Website</Link></p>
      </form>
    </AuthShell>
  );
}
