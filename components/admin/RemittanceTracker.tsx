"use client";
import { Download, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/fetcher";
import { FV_LABEL } from "@/lib/verification";
import { formatNaira } from "@/lib/money";

const VIEWS: [string, string][] = [["parishes_missing", "Yet to submit"], ["parishes_submitted", "Submitted"], ["pending", "Awaiting verification"], ["flagged", "Needs attention"], ["confirmed", "Confirmed"], ["outstanding", "Outstanding"], ["rejected", "Rejected"]];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Which parishes have paid their Youth Sunday remittance this period, and where each one stands. */
export function RemittanceTracker() {
  const now = new Date();
  const [f, setF] = useState({ year: now.getFullYear(), month: now.getMonth() + 1, metric: "parishes_missing" });
  const [rows, setRows] = useState<any[] | null>(null);
  const [err, setErr] = useState("");
  const [find, setFind] = useState("");
  const qs = `metric=${f.metric}&year=${f.year}&month=${f.month}`;
  useEffect(() => { setRows(null); setErr(""); api(`/api/finance/dashboard/records?${qs}`).then((r) => setRows(r.rows)).catch((e) => setErr(e.message)); }, [qs]);
  const shown = (rows ?? []).filter((r) => !find || `${r.parish} ${r.zone} ${r.area} ${r.reference}`.toLowerCase().includes(find.toLowerCase()));
  const money = !f.metric.startsWith("parishes");
  const status = (s: string) => (s === "not_submitted" ? "Not submitted" : s === "submitted" && !money ? "Submitted" : (FV_LABEL as Record<string, string>)[s] ?? s);
  return (
    <div className="space-y-4">
      <div className="glass flex flex-wrap items-end gap-3 p-4">
        <div><label className="label">Month</label><select className="input" value={f.month} onChange={(e) => setF({ ...f, month: Number(e.target.value) })}>{MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select></div>
        <div><label className="label">Year</label><input className="input !w-28" type="number" value={f.year} onChange={(e) => setF({ ...f, year: Number(e.target.value) })} /></div>
        <div><label className="label">Show</label><select className="input" value={f.metric} onChange={(e) => setF({ ...f, metric: e.target.value })}>{VIEWS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        <div className="min-w-[12rem] flex-1"><label className="label">Search</label><input className="input" placeholder="Parish, zone, reference" value={find} onChange={(e) => setFind(e.target.value)} /></div>
        {(["csv", "xlsx", "pdf"] as const).map((x) => <a key={x} className="btn btn-ghost btn-sm" href={`/api/finance/dashboard/records?${qs}&format=${x}`}><Download className="h-3.5 w-3.5" />{x.toUpperCase()}</a>)}
      </div>
      {err && <p className="text-red-300">{err}</p>}
      {!rows && !err && <div className="grid place-items-center py-12"><Loader2 className="h-5 w-5 animate-spin text-brand" /></div>}
      {rows && (
        <div className="glass overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-sm">
            <thead><tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-wide text-white/50"><th className="p-3">Parish</th><th>Zone / Area</th>{money && <th className="text-right">Amount</th>}<th>Status</th>{money && <th>Reference</th>}</tr></thead>
            <tbody>
              {shown.map((r, i) => (
                <tr key={r.id + i} className="border-b border-white/5">
                  <td className="p-3 font-semibold">{r.parish}</td><td className="text-xs text-white/60">{r.zone}{r.area ? ` · ${r.area}` : ""}</td>
                  {money && <td className="text-right tabular-nums">{formatNaira(r.amountKobo)}</td>}
                  <td><span className="badge">{status(r.status)}</span></td>{money && <td className="text-xs text-white/60">{r.reference || "—"}</td>}
                </tr>
              ))}
              {!shown.length && <tr><td colSpan={5} className="p-8 text-center text-white/50">Nothing here for this month.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-white/45">To verify a payment, open the <Link className="text-brand underline" href="/admin/finance">Finance Desk</Link>. Only confirmed payments count as received.</p>
    </div>
  );
}
