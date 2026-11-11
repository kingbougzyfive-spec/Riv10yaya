"use client";
import { CheckCircle2, Loader2, ShieldAlert } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/fetcher";
import { formatNaira } from "@/lib/money";
import { DataTable } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { Level } from "@/lib/status";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const OUT: Record<string, string> = { matched: "Matched to bank", not_found: "Not found in bank", amount_mismatch: "Different amount", rejected: "Rejected", resubmission_requested: "Resubmission requested" };
const LEVEL: Record<string, Level> = { matched: "ok", not_found: "bad", amount_mismatch: "bad", rejected: "bad", resubmission_requested: "warn" };

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
      {d && <div className="grid gap-3 sm:grid-cols-5">{Object.entries(OUT).map(([k, v]) => <div key={k} className="glass p-3 text-center"><p className="text-2xl font-black">{d.summary[k]}</p><p className="text-[11px] text-white/75">{v}</p></div>)}</div>}
      <div className="glass p-4">
        <DataTable<any>
          caption="Bank reconciliation records"
          rows={d?.rows} loading={!d && !err} error={err || null} onRetry={load} rowKey={(r) => r.id}
          searchText={(r) => `${r.parish} ${r.zone} ${r.area} ${r.bankReference ?? ""} ${r.transaction ?? ""} ${r.by ?? ""}`} searchPlaceholder="Search parish, bank reference or reviewer"
          empty={{ title: "No reconciliation records for these filters", hint: "They are created when finance reviews a payment." }}
          columns={[
            { key: "parish", header: "Parish", sortValue: (r) => r.parish, render: (r) => <><span className="font-semibold">{r.parish}</span><p className="text-xs text-white/75">{r.zone}{r.area ? ` · ${r.area}` : ""}</p></> },
            { key: "period", header: "Period", sortValue: (r) => r.year * 100 + r.month, render: (r) => <span className="text-xs">{MONTHS[r.month - 1]} {r.year}</span> },
            { key: "declared", header: "Declared", align: "right", sortValue: (r) => r.declaredKobo, render: (r) => <span className="tabular-nums">{formatNaira(r.declaredKobo)}</span> },
            { key: "bank", header: "Bank", align: "right", sortValue: (r) => r.bankKobo, render: (r) => <span className="tabular-nums">{formatNaira(r.bankKobo)}</span> },
            { key: "ref", header: "Reference", render: (r) => <span className="text-xs">{r.bankReference || "—"}{r.transaction && <span className="block font-mono text-white/75">{r.transaction}</span>}</span> },
            { key: "outcome", header: "Outcome", sortValue: (r) => r.outcome, render: (r) => <><StatusBadge view={{ label: OUT[r.outcome] ?? r.outcome, level: LEVEL[r.outcome] ?? "none" }} />{r.note && <p className="mt-1 max-w-[16rem] text-xs text-white/75">{r.note}</p>}</> },
            { key: "by", header: "Reviewed", sortValue: (r) => r.at, render: (r) => <span className="text-xs text-white/75">{r.by}<span className="block">{new Date(r.at).toLocaleDateString("en-NG", { dateStyle: "medium" })}</span></span> },
          ]}
        />
      </div>
    </div>
  );
}
