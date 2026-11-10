"use client";
import { CheckCircle2, Loader2, ShieldAlert } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/fetcher";
import { formatNaira } from "@/lib/money";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const OUT: Record<string, string> = { matched: "Matched to bank", not_found: "Not found in bank", amount_mismatch: "Different amount", rejected: "Rejected", resubmission_requested: "Resubmission requested" };

/** Bank reconciliation: each payment against the bank statement, plus a check that the confirmed-payments ledger agrees with the remittance records. */
export function ReconciliationView({ canFix }: { canFix: boolean }) {
  const toast = useToast();
  const now = new Date();
  const [f, setF] = useState({ year: String(now.getFullYear()), month: String(now.getMonth() + 1), outcome: "" });
  const [d, setD] = useState<any>(null);
  const [chk, setChk] = useState<any>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    const p = new URLSearchParams(); for (const [k, v] of Object.entries(f)) if (v) p.set(k, String(v));
    setD(null); api(`/api/finance/reconciliation?${p}`).then(setD).catch((e) => setErr(e.message));
  }, [f]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (canFix) api("/api/finance/ledger").then(setChk).catch(() => {}); }, [canFix]);
  const backfill = async () => { setBusy(true); try { const r = await api("/api/finance/ledger", { method: "POST" }); toast.ok(`${r.made} ledger row${r.made === 1 ? "" : "s"} created`); setChk(await api("/api/finance/ledger")); } catch (e: any) { toast.err(e.message); } setBusy(false); };

  return (
    <div className="space-y-5">
      {chk && (
        <div className={`glass flex flex-wrap items-center gap-3 p-4 ${chk.ok ? "ring-1 ring-emerald-400/40" : "ring-1 ring-amber-300/50"}`}>
          {chk.ok ? <CheckCircle2 className="h-5 w-5 text-emerald-300" /> : <ShieldAlert className="h-5 w-5 text-amber-300" />}
          <p className="min-w-0 flex-1 text-sm"><b>{chk.ok ? "The ledger agrees with the remittance records." : `The ledger is missing ${chk.missing.length} confirmed payment${chk.missing.length === 1 ? "" : "s"}${chk.mismatched.length ? ` and ${chk.mismatched.length} differ in amount` : ""}.`}</b> Confirmed on remittances {formatNaira(chk.remittanceConfirmedKobo)} · in ledger {formatNaira(chk.ledgerKobo)}.</p>
          {!chk.ok && chk.missing.length > 0 && <button className="btn btn-primary btn-sm" disabled={busy} onClick={backfill}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Add missing ledger rows</button>}
        </div>
      )}
      <div className="glass flex flex-wrap items-end gap-3 p-4">
        <div><label className="label">Month</label><select className="input" value={f.month} onChange={(e) => setF({ ...f, month: e.target.value })}><option value="">All</option>{MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select></div>
        <div><label className="label">Year</label><input className="input !w-28" type="number" value={f.year} onChange={(e) => setF({ ...f, year: e.target.value })} /></div>
        <div><label className="label">Outcome</label><select className="input" value={f.outcome} onChange={(e) => setF({ ...f, outcome: e.target.value })}><option value="">All</option>{Object.entries(OUT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
      </div>
      {err && <p className="text-red-300">{err}</p>}
      {!d && !err && <div className="skeleton h-40" />}
      {d && (
        <>
          <div className="grid gap-3 sm:grid-cols-5">{Object.entries(OUT).map(([k, v]) => <div key={k} className="glass p-3 text-center"><p className="text-2xl font-black">{d.summary[k]}</p><p className="text-[11px] text-white/55">{v}</p></div>)}</div>
          <div className="glass overflow-x-auto p-0">
            <table className="w-full min-w-[760px] text-sm">
              <thead><tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-wide text-white/50"><th className="p-3">Parish</th><th>Period</th><th className="text-right">Declared</th><th className="text-right">Bank</th><th>Reference</th><th>Outcome</th><th>By</th></tr></thead>
              <tbody>
                {d.rows.map((r: any) => (
                  <tr key={r.id} className="border-b border-white/5 align-top">
                    <td className="p-3 font-semibold">{r.parish}<p className="text-xs font-normal text-white/45">{r.zone}{r.area ? ` · ${r.area}` : ""}</p></td>
                    <td className="text-xs">{MONTHS[r.month - 1]} {r.year}</td>
                    <td className="text-right tabular-nums">{formatNaira(r.declaredKobo)}</td>
                    <td className="text-right tabular-nums">{formatNaira(r.bankKobo)}</td>
                    <td className="text-xs text-white/60">{r.bankReference || "—"}{r.transaction && <p className="font-mono text-white/40">{r.transaction}</p>}</td>
                    <td><span className="badge">{OUT[r.outcome]}</span>{r.note && <p className="mt-1 max-w-[16rem] text-xs text-white/45">{r.note}</p>}</td>
                    <td className="text-xs text-white/55">{r.by}<p>{new Date(r.at).toLocaleDateString("en-NG", { dateStyle: "medium" })}</p></td>
                  </tr>
                ))}
                {!d.rows.length && <tr><td colSpan={7} className="p-8 text-center text-white/50">No reconciliation records for these filters yet. They are created when finance reviews a payment.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
