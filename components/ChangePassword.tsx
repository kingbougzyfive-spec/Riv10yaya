"use client";
import { KeyRound, Loader2 } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/fetcher";

export function ChangePassword() {
  const toast = useToast();
  const [f, setF] = useState({ current: "", next: "", again: "" });
  const [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (f.next !== f.again) return toast.err("The new passwords don't match.");
    setBusy(true);
    try { await api("/api/auth/password", { method: "POST", json: { current: f.current, next: f.next } }); toast.ok("Password changed"); setF({ current: "", next: "", again: "" }); }
    catch (er: any) { toast.err(er.message); }
    setBusy(false);
  }
  return (
    <form onSubmit={save} className="glass max-w-md space-y-4 p-5">
      <p className="flex items-center gap-2 font-bold"><KeyRound className="h-4 w-4 text-accent" />Change password</p>
      <div><label className="label">Current password</label><input className="input" type="password" autoComplete="current-password" required value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} /></div>
      <div><label className="label">New password</label><input className="input" type="password" autoComplete="new-password" minLength={10} required value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} /><p className="hint">At least 10 characters.</p></div>
      <div><label className="label">Repeat new password</label><input className="input" type="password" autoComplete="new-password" required value={f.again} onChange={(e) => setF({ ...f, again: e.target.value })} /></div>
      <button className="btn btn-primary" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Update password</button>
    </form>
  );
}
