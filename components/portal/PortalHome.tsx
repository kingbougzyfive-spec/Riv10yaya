"use client";
import { CheckCircle2, CircleDashed, ClipboardList, Wallet } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/fetcher";
import { formatNaira, MONTHS } from "@/lib/money";
import { FV_LABEL } from "@/lib/verification";

/** This month at a glance: has the remittance been recorded and verified, has the activity report been submitted, what is due next. */
export function PortalHome({ parish }: { parish: string }) {
  const now = new Date();
  const month = now.getMonth() + 1, year = now.getFullYear();
  const [ctx, setCtx] = useState<any>(null);
  const [err, setErr] = useState("");
  useEffect(() => { api(`/api/reports/context?month=${month}&year=${year}`).then(setCtx).catch((e) => setErr(e.message)); }, [month, year]);
  const r = ctx?.remittance;
  const due = new Date(Date.UTC(month === 12 ? year + 1 : year, month === 12 ? 0 : month, 10) - 3600_000);
  return (
    <div className="space-y-5">
      <div className="glass p-5"><p className="text-xs uppercase tracking-widest text-white/45">Parish</p><p className="text-2xl font-black">{parish}</p><p className="mt-1 text-sm text-white/55">{MONTHS[month - 1]} {year} · due {due.toLocaleDateString("en-NG", { dateStyle: "long" })}</p></div>
      {err && <p className="glass p-4 text-sm text-red-300">{err}</p>}
      {!ctx && !err && <div className="grid gap-4 sm:grid-cols-2"><div className="skeleton h-36" /><div className="skeleton h-36" /></div>}
      {ctx && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="glass p-5">
            <p className="flex items-center gap-2 font-bold"><Wallet className="h-4 w-4 text-brand" />Youth Sunday remittance</p>
            {r ? (<><p className="mt-3 flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-emerald-300" />Recorded · {(FV_LABEL as Record<string, string>)[r.status] ?? r.status}</p><p className="mt-1 text-sm text-white/60">Required {formatNaira(r.requiredKobo)}. Only payments confirmed by finance count as received.</p><Link href="/portal/payment-evidence" className="btn btn-ghost btn-sm mt-4">View payment status</Link></>)
              : (<><p className="mt-3 flex items-center gap-2 text-sm text-amber-200"><CircleDashed className="h-4 w-4" />Not recorded yet</p><p className="mt-1 text-sm text-white/60">Pay into the provincial account, then record it with your receipt.</p><Link href="/portal/remittance" className="btn btn-primary btn-sm mt-4">Record remittance</Link></>)}
          </div>
          <div className="glass p-5">
            <p className="flex items-center gap-2 font-bold"><ClipboardList className="h-4 w-4 text-brand" />Monthly activity report</p>
            {ctx.submitted ? (<><p className="mt-3 flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-emerald-300" />Submitted {new Date(ctx.submitted.at).toLocaleDateString("en-NG", { dateStyle: "medium" })}</p><Link href="/portal/history" className="btn btn-ghost btn-sm mt-4">See history</Link></>)
              : (<><p className="mt-3 flex items-center gap-2 text-sm text-amber-200"><CircleDashed className="h-4 w-4" />{ctx.draft ? "Draft saved, not submitted" : "Not submitted yet"}</p><p className="mt-1 text-sm text-white/60">Your report is separate from payment verification and is never held back by it.</p><Link href="/portal/monthly-report" className="btn btn-primary btn-sm mt-4">{ctx.draft ? "Continue report" : "Start report"}</Link></>)}
          </div>
        </div>
      )}
    </div>
  );
}
