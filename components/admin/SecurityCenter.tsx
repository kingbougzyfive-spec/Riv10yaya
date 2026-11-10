"use client";
import { AlertTriangle, CheckCircle2, Download, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/fetcher";

type Check = { id: string; level: "ok" | "warn" | "fail"; title: string; detail: string };
type Err = { id: string; requestId: string; at: string; method: string; path: string; message: string; stack: string };
const ICON = { ok: <CheckCircle2 className="h-5 w-5 text-emerald-300" />, warn: <AlertTriangle className="h-5 w-5 text-amber-300" />, fail: <XCircle className="h-5 w-5 text-red-400" /> };

export function SecurityCenter() {
  const [d, setD] = useState<{ checks: Check[]; errors: Err[] } | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => { api("/api/security").then(setD).catch((e) => setErr(e.message)); }, []);
  if (err) return <p className="text-red-300">{err}</p>;
  if (!d) return <div className="space-y-3"><div className="skeleton h-24" /><div className="skeleton h-48" /></div>;
  const bad = d.checks.filter((c) => c.level === "fail").length, warn = d.checks.filter((c) => c.level === "warn").length;
  return (
    <div className="space-y-6">
      <div className={`glass flex items-center gap-3 p-5 ${bad ? "ring-1 ring-red-400/50" : warn ? "ring-1 ring-amber-300/40" : "ring-1 ring-emerald-400/40"}`}>
        <ShieldCheck className="h-6 w-6 text-brand" />
        <p className="font-bold">{bad ? `${bad} item${bad > 1 ? "s" : ""} need attention before going live` : warn ? `${warn} suggestion${warn > 1 ? "s" : ""}` : "Everything checked is in order"}</p>
      </div>
      <ul className="grid gap-3 md:grid-cols-2">
        {d.checks.map((c) => (
          <li key={c.id} className="glass flex gap-3 p-4">{ICON[c.level]}<div><p className="font-semibold">{c.title}</p><p className="mt-0.5 text-sm text-white/60">{c.detail}</p></div></li>
        ))}
      </ul>
      <section className="glass space-y-3 p-5">
        <p className="font-bold">Backups</p>
        <p className="text-sm text-white/60">Your real protection is database backups from MongoDB Atlas (continuous or scheduled snapshots) plus a linked backup database under Admin, Database. This download is an extra safety copy of the records. It leaves out passwords, tokens and uploaded file contents, and may be refused when the data is large.</p>
        <a className="btn btn-ghost" href="/api/security/backup"><Download className="h-4 w-4" />Download data copy (.jsonl.gz)</a>
      </section>
      <section className="glass overflow-hidden p-0">
        <p className="border-b border-white/10 p-4 font-bold">Recent server errors</p>
        {d.errors.length === 0 ? <p className="p-6 text-center text-sm text-white/45">None recorded.</p> : (
          <ul className="divide-y divide-white/10">
            {d.errors.map((e) => (
              <li key={e.id} className="p-4 text-sm"><p><span className="font-mono text-xs text-brand">{e.requestId}</span> <span className="text-white/50">{new Date(e.at).toLocaleString("en-NG")} · {e.method} {e.path}</span></p><p className="mt-1 text-white/75">{e.message}</p></li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
