"use client";
import { motion } from "framer-motion";
import { Download, FilePlus2, Phone } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/fetcher";
import { cn } from "@/lib/cn";
import { formatNaira, MONTHS } from "@/lib/money";
import { FIELDS } from "@/lib/report-config";
import { PeriodPicker, statusBadge, statusLabel } from "./report-bits";

const Bar = ({ a, b, label }: { a: number; b: number; label: string }) => (
  <div className="glass p-5">
    <p className="text-xs uppercase tracking-wider text-white/45">{label}</p>
    <p className="mt-1 text-2xl font-black">{a}<span className="text-base font-semibold text-white/40"> / {b}</span></p>
    <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"><motion.div className="h-full rounded-full bg-gradient-to-r from-brand to-accent" initial={{ width: 0 }} animate={{ width: `${b ? (a / b) * 100 : 0}%` }} transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }} /></div>
  </div>
);

const Tel = ({ n }: { n?: string }) => (n ? <a href={`tel:${n}`} className="inline-flex items-center gap-1.5 font-semibold text-brand hover:underline"><Phone className="h-3.5 w-3.5" />{n}</a> : null);

export function ReportsHub({ canSubmit }: { canSubmit: boolean }) {
  const toast = useToast();
  const now = new Date();
  const [p, setP] = useState({ month: now.getMonth() + 1, year: now.getFullYear() });
  const [type, setType] = useState("");
  const [sum, setSum] = useState<any>(null);
  const [rows, setRows] = useState<any[] | null>(null);
  const [open, setOpen] = useState<any>(null);

  useEffect(() => {
    setRows(null); setSum(null);
    api(`/api/reports/summary?month=${p.month}&year=${p.year}`).then(setSum).catch((e) => toast.err(e.message));
    api(`/api/reports?month=${p.month}&year=${p.year}${type ? `&type=${type}` : ""}`).then((r) => setRows(r.rows)).catch((e) => { toast.err(e.message); setRows([]); });
  }, [p, type, toast]);

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <PeriodPicker month={p.month} year={p.year} onChange={(month, year) => setP({ month, year })} />
        <select className="input !w-auto" value={type} onChange={(e) => setType(e.target.value)}><option value="">All levels</option><option value="parish">Parish</option><option value="area">Area</option><option value="zone">Zonal</option></select>
        <div className="ml-auto flex gap-2">
          {([["xlsx", "Excel"], ["pdf", "PDF"], ["csv", "CSV"]] as const).map(([f, l]) => <a key={f} className="btn btn-ghost" href={`/api/reports/export?month=${p.month}&year=${p.year}${type ? `&type=${type}` : ""}&format=${f}`}><Download className="h-4 w-4" />{l}</a>)}
          {canSubmit && <Link href="/admin/reports/new" className="btn btn-primary"><FilePlus2 className="h-4 w-4" />Submit report</Link>}
        </div>
      </div>

      {sum ? (
        <div className="mb-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-3"><Bar a={sum.parishes.submitted} b={sum.parishes.total} label="Parish reports" /><Bar a={sum.areas.submitted} b={sum.areas.total} label="Area reports" /><Bar a={sum.zones.submitted} b={sum.zones.total} label="Zonal reports" /></div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[{ l: "Required remittance", v: sum.finance.requiredKobo }, { l: "Declared paid", v: sum.finance.declaredKobo }, { l: "Confirmed by finance", v: sum.finance.confirmedKobo }, { l: `Levies (separate · ${sum.levies.count})`, v: sum.levies.totalKobo }].map((x) => (
              <div key={x.l} className="glass p-5"><p className="text-xs uppercase tracking-wider text-white/45">{x.l}</p><p className="mt-1 text-xl font-black">{formatNaira(x.v)}</p></div>
            ))}
          </div>
          {sum.byZone.length > 1 && (
            <div className="glass overflow-x-auto p-0"><table className="w-full min-w-[520px] text-left text-sm"><thead className="text-xs uppercase tracking-wider text-white/45"><tr><th className="p-3">Zone</th><th className="p-3">Parish reports</th><th className="p-3">Required</th><th className="p-3">Confirmed</th><th className="p-3">Zonal report</th></tr></thead><tbody>
              {sum.byZone.map((z: any) => <tr key={z.id} className="border-t border-white/10"><td className="p-3 font-semibold">{z.name}</td><td className="p-3">{z.submitted}/{z.parishes}</td><td className="p-3">{formatNaira(z.requiredKobo)}</td><td className="p-3">{formatNaira(z.confirmedKobo)}</td><td className="p-3"><span className={cn("badge", z.reportSubmitted ? "badge-ok" : "badge-warn")}>{z.reportSubmitted ? "Submitted" : "Outstanding"}</span></td></tr>)}
            </tbody></table></div>
          )}
          {sum.outstanding.length > 0 && <div className="glass p-5"><p className="mb-3 text-sm font-bold">Outstanding parish reports ({sum.parishes.total - sum.parishes.submitted})</p><div className="flex flex-wrap gap-1.5">{sum.outstanding.map((o: any) => <span key={o.id} className={cn("badge", o.remitted ? "badge-warn" : "badge-bad")} title={o.remitted ? "Remitted, activity report missing" : "Nothing submitted"}>{o.name}</span>)}</div></div>}
        </div>
      ) : <div className="skeleton mb-6 h-32" />}

      <div className="grid gap-3">
        {rows === null && [0, 1, 2].map((i) => <div key={i} className="skeleton h-20" />)}
        {rows?.map((r, i) => (
          <motion.button key={r.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.4) }} onClick={() => setOpen(r)} className="glass glass-hover flex flex-wrap items-center justify-between gap-3 p-4 text-left">
            <div className="min-w-0"><p className="truncate font-bold">{r.names.parish ?? r.names.area ?? r.names.zone}</p><p className="truncate text-xs text-white/45">{[r.names.zone, r.names.area].filter(Boolean).join(" → ")} · {MONTHS[r.month - 1]} {r.year}</p></div>
            <div className="flex flex-wrap items-center gap-2"><span className="badge capitalize">{r.type}</span>{r.remittance && <span className={statusBadge[r.remittance.status]}>{statusLabel[r.remittance.status]}</span>}{r.contact && <span className="text-xs text-white/55">{r.contact.fullName}</span>}</div>
          </motion.button>
        ))}
        {rows?.length === 0 && <div className="glass p-10 text-center text-white/45">No reports submitted for {MONTHS[p.month - 1]} {p.year} yet.</div>}
      </div>

      <Modal open={!!open} onClose={() => setOpen(null)} wide title={open ? `${open.names.parish ?? open.names.area ?? open.names.zone} · ${MONTHS[open.month - 1]} ${open.year}` : ""}>
        {open && (
          <div className="space-y-5 text-sm">
            <div className="grid gap-3 sm:grid-cols-3">{[["Zone", open.names.zone], ["Area", open.names.area ?? "—"], ["Parish", open.names.parish ?? "—"]].map(([k, v]) => <div key={k}><p className="label">{k}</p><b>{v}</b></div>)}</div>
            {open.contact ? (
              <div className="rounded-2xl border border-brand/30 bg-brand/10 p-4">
                <p className="mb-2 text-xs font-black tracking-wider">ADMINISTRATOR'S CONTACT INFORMATION</p>
                <p className="font-bold">{open.contact.fullName}</p>
                <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1"><Tel n={open.contact.phone} />{open.contact.altPhone && <Tel n={open.contact.altPhone} />}</div>
                <p className="mt-2 text-[11px] text-white/45">As entered when this report was submitted.</p>
              </div>
            ) : <p className="rounded-xl bg-white/5 p-3 text-xs text-white/50">Contact details are visible to authorised administrators only.</p>}
            {open.remittance && <div className="rounded-xl bg-white/5 p-4"><p className="label">Youth Sunday remittance</p><p>Offering {formatNaira(open.remittance.offeringKobo)} · required <b>{formatNaira(open.remittance.requiredKobo)}</b> · <span className={statusBadge[open.remittance.status]}>{statusLabel[open.remittance.status]}</span></p></div>}
            {open.rollup && <div className="rounded-xl bg-white/5 p-4"><p className="label">Consolidation at submission</p><p className="text-white/70">{Object.entries(open.rollup).filter(([, v]) => typeof v === "number").map(([k, v]) => `${k.replace(/([A-Z])/g, " $1").toLowerCase()}: ${v}`).join(" · ")}</p></div>}
            <div className="space-y-3">{FIELDS[open.type as "parish"].map((f) => open.activity?.[f.key] !== undefined && open.activity?.[f.key] !== null && open.activity?.[f.key] !== "" ? <div key={f.key}><p className="label">{f.label}</p><p className="whitespace-pre-line text-white/80">{String(open.activity[f.key])}</p></div> : null)}</div>
          </div>
        )}
      </Modal>
    </>
  );
}
