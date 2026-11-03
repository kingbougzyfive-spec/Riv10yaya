"use client";
import { Loader2, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AuthShell } from "@/components/AuthShell";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/fetcher";

function Form() {
  const toast = useToast();
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const [pw, setPw] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw !== again) return toast.err("The passwords don't match.");
    setBusy(true);
    try { await api("/api/auth/reset", { method: "POST", json: { token, password: pw } }); toast.ok("Password updated. Please sign in."); router.push("/login"); }
    catch (er: any) { toast.err(er.message); setBusy(false); }
  }
  if (!token) return <p className="text-sm text-white/60">This link is missing its token. <Link href="/forgot" className="text-brand underline">Request a new one</Link>.</p>;
  return (
    <form onSubmit={submit} className="space-y-4">
      <div><label className="label">New password</label><input className="input" type="password" minLength={10} required autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /><p className="hint">At least 10 characters.</p></div>
      <div><label className="label">Repeat password</label><input className="input" type="password" required autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} /></div>
      <button className="btn btn-primary w-full py-3" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}Set new password</button>
    </form>
  );
}

export default function ResetPage() {
  return <AuthShell title="Choose a new password"><Suspense fallback={<div className="skeleton h-40" />}><Form /></Suspense></AuthShell>;
}
