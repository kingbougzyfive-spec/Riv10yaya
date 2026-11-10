"use client";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/fetcher";

const LINKS: [string, string, string][] = [
  ["/admin/finance", "Finance settings", "Percentage and the provincial bank account (Finance Desk)."],
  ["/admin/site", "Website content", "Text, images, colours and navigation of the public site."],
  ["/admin/integrations/sheets", "Google Sheets", "Sync status, retries and tab selection."],
  ["/admin/database", "Database", "Connections and backup copies."],
  ["/admin/security", "Security", "Deployment checklist, errors and backups."],
  ["/admin/users", "Users and roles", "Create administrators and assign scope."],
];

/** System settings: reporting periods and the role/permission catalogue, with shortcuts to the other settings pages. */
export function SettingsHub({ canPeriods, canCatalog }: { canPeriods: boolean; canCatalog: boolean }) {
  const toast = useToast();
  const [periods, setPeriods] = useState<any[] | null>(null);
  const [cat, setCat] = useState<any>(null);
  const [busy, setBusy] = useState("");
  const load = useCallback(() => api("/api/periods").then((r) => setPeriods(r.periods)).catch(() => setPeriods([])), []);
  useEffect(() => { load(); if (canCatalog) api("/api/security/rbac").then(setCat).catch(() => {}); }, [load, canCatalog]);
  const setStatus = async (p: any, status: string) => {
    const reason = window.prompt(`Why is ${p.label} being set to "${status}"?`);
    if (!reason || reason.trim().length < 3) return;
    setBusy(p.key);
    try { await api("/api/periods", { method: "PATCH", json: { year: p.year, month: p.month, status, reason } }); toast.ok("Updated"); await load(); } catch (e: any) { toast.err(e.message); }
    setBusy("");
  };
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{LINKS.map(([href, t, s]) => <Link key={href} href={href} className="glass glass-hover p-4"><p className="font-bold">{t}</p><p className="mt-1 text-sm text-white/55">{s}</p></Link>)}</div>
      <section className="glass overflow-hidden p-0">
        <div className="border-b border-white/10 p-4"><p className="font-bold">Reporting periods</p><p className="text-sm text-white/55">Each month is due on the 10th of the next month. <b>Locking</b> a month stops new submissions for it; finance can still verify what was already sent.</p></div>
        {!periods ? <div className="p-6 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-brand" /></div> : periods.length === 0 ? <p className="p-6 text-center text-sm text-white/50">Periods appear automatically when the first report or remittance for a month is submitted.</p> : (
          <ul className="divide-y divide-white/10">{periods.map((p) => (
            <li key={p.key} className="flex flex-wrap items-center gap-3 p-4 text-sm"><b className="w-36">{p.label}</b><span className="text-white/55">due {new Date(p.dueAt).toLocaleDateString("en-NG", { dateStyle: "medium" })}</span><span className="badge">{p.status}</span>
              {canPeriods && <span className="ml-auto flex gap-1">{["open", "closed", "locked"].filter((s) => s !== p.status).map((s) => <button key={s} className="btn btn-ghost btn-sm" disabled={busy === p.key} onClick={() => setStatus(p, s)}>{s === "open" ? "Reopen" : s === "closed" ? "Close" : "Lock"}</button>)}</span>}
            </li>))}</ul>
        )}
      </section>
      {cat && (
        <section className="glass overflow-hidden p-0">
          <div className="border-b border-white/10 p-4"><p className="font-bold">Roles and permissions</p><p className="text-sm text-white/55">What each role may do, as enforced by the server. This list is read-only: access is defined in code, not here.</p></div>
          <ul className="divide-y divide-white/10">{cat.roles.map((r: any) => <li key={r.key} className="p-4 text-sm"><p><b>{r.label}</b> <span className="text-xs text-white/45">· {r.level.replace("_", " ")}</span></p><p className="mt-1 text-xs text-white/55">{r.permissions.join(", ") || "No administrative permissions"}</p></li>)}</ul>
        </section>
      )}
    </div>
  );
}
