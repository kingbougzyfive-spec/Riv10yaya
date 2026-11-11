"use client";
import { Download } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/fetcher";
import { DataTable } from "@/components/ui/DataTable";
import { FinanceBadge, TimelinessBadge } from "@/components/ui/StatusBadge";
import { formatNaira } from "@/lib/money";

const VIEWS: [string, string][] = [["parishes_missing", "Yet to submit"], ["parishes_submitted", "Submitted"], ["pending", "Awaiting verification"], ["flagged", "Needs attention"], ["confirmed", "Confirmed"], ["outstanding", "Outstanding"], ["rejected", "Rejected"]];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Which parishes have paid their Youth Sunday remittance this period, and where each one stands. */
export function RemittanceTracker() {
  const now = new Date();
  const [f, setF] = useState({ year: now.getFullYear(), month: now.getMonth() + 1, metric: "parishes_missing" });
  const [rows, setRows] = useState<any[] | null>(null);
  const [err, setErr] = useState("");
  const qs = `metric=${f.metric}&year=${f.year}&month=${f.month}`;
  useEffect(() => { setRows(null); setErr(""); api(`/api/finance/dashboard/records?${qs}`).then((r) => setRows(r.rows)).catch((e) => setErr(e.message)); }, [qs]);
  const money = !f.metric.startsWith("parishes");
  return (
    <div className="space-y-4">
      <div className="glass flex flex-wrap items-end gap-3 p-4">
        <div><label className="label">Month</label><select className="input" value={f.month} onChange={(e) => setF({ ...f, month: Number(e.target.value) })}>{MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select></div>
        <div><label className="label">Year</label><input className="input !w-28" type="number" value={f.year} onChange={(e) => setF({ ...f, year: Number(e.target.value) })} /></div>
        <div><label className="label">Show</label><select className="input" value={f.metric} onChange={(e) => setF({ ...f, metric: e.target.value })}>{VIEWS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        {(["csv", "xlsx", "pdf"] as const).map((x) => <a key={x} className="btn btn-ghost btn-sm" href={`/api/finance/dashboard/records?${qs}&format=${x}`}><Download className="h-3.5 w-3.5" />{x.toUpperCase()}</a>)}
      </div>
      <div className="glass p-4">
        <DataTable<any>
          caption="Remittances for the selected month"
          rows={rows} error={err || null} loading={!rows && !err} rowKey={(r) => r.id}
          searchText={(r) => `${r.parish} ${r.zone} ${r.area} ${r.reference ?? ""}`} searchPlaceholder="Search parish, zone or reference"
          empty={{ title: "Nothing here for this month", hint: "Try another month or a different view." }}
          columns={[
            { key: "parish", header: "Parish", sortValue: (r) => r.parish, render: (r) => <span className="font-semibold">{r.parish}</span> },
            { key: "zone", header: "Zone / Area", sortValue: (r) => r.zone, render: (r) => <span className="text-xs text-white/75">{r.zone}{r.area ? ` · ${r.area}` : ""}</span> },
            ...(money ? [{ key: "amount", header: "Amount", align: "right" as const, sortValue: (r: any) => r.amountKobo ?? 0, render: (r: any) => <span className="tabular-nums">{formatNaira(r.amountKobo)}</span> }] : []),
            { key: "status", header: "Status", sortValue: (r) => r.status, render: (r) => (r.status === "not_submitted" ? <TimelinessBadge status="not_submitted" /> : money ? <FinanceBadge status={r.status} /> : <span className="badge badge-ok">Submitted</span>) },
            ...(money ? [{ key: "ref", header: "Reference", sortValue: (r: any) => r.reference ?? "", render: (r: any) => <span className="text-xs text-white/75">{r.reference || "—"}</span> }] : []),
          ]}
        />
      </div>
      <p className="text-xs text-white/65">To verify a payment, open the <Link className="text-brand underline" href="/admin/finance">Finance Desk</Link>. Only confirmed payments count as received.</p>
    </div>
  );
}
