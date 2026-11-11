"use client";
import { DataTable } from "@/components/ui/DataTable";
import { FinanceBadge, ReportBadge, StatusBadge } from "@/components/ui/StatusBadge";
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
import { COMPLIANCE_BADGE, FV_LABEL, REPORT_BADGE, REPORT_LABEL, type ReportStatus } from "@/lib/verification";
import { ActivityFields, ContactSection, PeriodPicker, statusBadge, statusLabel, type Contact } from "./report-bits";

const Bar = ({ a, b, label }: { a: number; b: number; label: string }) => (
  <div className="glass p-5">
    <p className="text-xs uppercase tracking-wider text-white/65">{label}</p>
    <p className="mt-1 text-2xl font-black">{a}<span className="text-base font-semibold text-white/65"> / {b}</span></p>
    <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"><motion.div className="h-full rounded-full bg-gradient-to-r from-brand to-accent" initial={{ width: 0 }} animate={{ width: `${b ? (a / b) * 100 : 0}%` }} transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }} /></div>
  </div>
);

const Tel = ({ n }: { n?: string }) => (n ? <a href={`tel:${n}`} className="inline-flex items-center gap-1.5 font-semibold text-brand hover:underline"><Phone className="h-3.5 w-3.5" />{n}</a> : null);

export function ReportsHub({ canSubmit, canReview }: { canSubmit: boolean; canReview?: boolean }) {
  const toast = useToast();
  const now = new Date();
  const [p, setP] = useState({ month: now.getMonth() + 1, year: now.getFullYear() });
  const [type, setType] = useState("");
  const [sum, setSum] = useState<any>(null);
  const [rows, setRows] = useState<any[] | null>(null);
  const [open, setOpen] = useState<any>(null);
  const [org, setOrg] = useState<{ zones: any[]; areas: any[]; parishes: any[] } | null>(null);
  const [f, setF] = useState({ zone: "", area: "", parish: "", status: "", fin: "" });
  const [revising, setRevising] = useState<any>(null);
  useEffect(() => { api("/api/org").then((d) => setOrg({ zones: d.zones ?? [], areas: d.areas ?? [], parishes: d.parishes ?? [] })).catch(() => setOrg(null)); }, []);
  const filterQs = [["type", type], ["zone", f.zone], ["area", f.area], ["parish", f.parish], ["status", f.status], ["finance", f.fin]].filter(([, v]) => v).map(([k, v]) => `&${k}=${v}`).join("");
  const areaOpts = org?.areas.filter((a) => !f.zone || String(a.zone?.id ?? a.zone) === f.zone) ?? [];
  const parishOpts = org?.parishes.filter((x) => (!f.zone || String(x.zone?.id ?? x.zone) === f.zone) && (!f.area || String(x.area?.id ?? x.area) === f.area)) ?? [];
  const reload = () => { setRows(null); api(`/api/reports?month=${p.month}&year=${p.year}${filterQs}`).then((r) => setRows(r.rows)).catch((e) => { toast.err(e.message); setRows([]); }); };

  useEffect(() => {
    setRows(null); setSum(null);
    api(`/api/reports/summary?month=${p.month}&year=${p.year}`).then(setSum).catch((e) => toast.err(e.message));
    api(`/api/reports?month=${p.month}&year=${p.year}${filterQs}`).then((r) => setRows(r.rows)).catch((e) => { toast.err(e.message); setRows([]); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p, filterQs, toast]);

  const [tab, setTab] = useState<"reports" | "compliance">("reports");
  return (
    <>
      <div className="mb-5 grid max-w-md grid-cols-2 gap-1 rounded-2xl border border-white/10 bg-white/5 p-1" role="tablist">
        {([["reports", "Reports"], ["compliance", "Compliance"]] as const).map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cn("rounded-xl py-2 text-sm font-semibold transition", tab === k ? "bg-brand text-[#04130d]" : "text-white/65 hover:text-white")}>{l}</button>)}
      </div>
      {tab === "compliance" ? <ComplianceView month={p.month} year={p.year} onPeriod={(month, year) => setP({ month, year })} /> : <>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <PeriodPicker month={p.month} year={p.year} onChange={(month, year) => setP({ month, year })} />
        <select className="input !w-auto" aria-label="Report type" value={type} onChange={(e) => setType(e.target.value)}><option value="">All report types</option><option value="parish">Parish</option><option value="area">Area</option><option value="zone">Zonal</option></select>
        {org && org.zones.length > 1 && <select className="input !w-auto" aria-label="Zone" value={f.zone} onChange={(e) => setF({ ...f, zone: e.target.value, area: "", parish: "" })}><option value="">All zones</option>{org.zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}</select>}
        {org && areaOpts.length > 1 && <select className="input !w-auto" aria-label="Area" value={f.area} onChange={(e) => setF({ ...f, area: e.target.value, parish: "" })}><option value="">All areas</option>{areaOpts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>}
        {org && parishOpts.length > 1 && <select className="input !w-auto" aria-label="Parish" value={f.parish} onChange={(e) => setF({ ...f, parish: e.target.value })}><option value="">All parishes</option>{parishOpts.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>}
        <select className="input !w-auto" aria-label="Submission status" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="">Any report status</option>{(["submitted", "completed", "revision_requested", "incomplete"] as const).map((k) => <option key={k} value={k}>{REPORT_LABEL[k]}</option>)}</select>
        <select className="input !w-auto" aria-label="Financial verification" value={f.fin} onChange={(e) => setF({ ...f, fin: e.target.value })}><option value="">Any financial status</option>{Object.entries(FV_LABEL).filter(([k]) => k !== "awaiting_evidence").map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        {(type || f.zone || f.area || f.parish || f.status || f.fin) && <button className="btn btn-ghost btn-sm" onClick={() => { setType(""); setF({ zone: "", area: "", parish: "", status: "", fin: "" }); }}>Clear filters</button>}
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
              <div key={x.l} className="glass p-5"><p className="text-xs uppercase tracking-wider text-white/65">{x.l}</p><p className="mt-1 text-xl font-black">{formatNaira(x.v)}</p></div>
            ))}
          </div>
          {sum.byZone.length > 1 && (
            <div className="glass overflow-x-auto p-0"><table className="w-full min-w-[520px] text-left text-sm"><thead className="text-xs uppercase tracking-wider text-white/65"><tr><th className="p-3">Zone</th><th className="p-3">Parish reports</th><th className="p-3">Required</th><th className="p-3">Confirmed</th><th className="p-3">Zonal report</th></tr></thead><tbody>
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
            <div className="min-w-0"><p className="truncate font-bold">{r.names.parish ?? r.names.area ?? r.names.zone}</p><p className="truncate text-xs text-white/65">{[r.names.zone, r.names.area].filter(Boolean).join(" → ")} · {MONTHS[r.month - 1]} {r.year}</p></div>
            <div className="flex flex-wrap items-center gap-2"><span className="badge capitalize">{r.type}</span><span className={REPORT_BADGE[r.status as ReportStatus]}>{REPORT_LABEL[r.status as ReportStatus]}</span>{r.revision > 1 && <span className="badge">Revised v{r.revision}</span>}{r.remittance && <span className={statusBadge[r.remittance.status]}>{statusLabel[r.remittance.status]}</span>}{r.contact && <span className="text-xs text-white/65">{r.contact.fullName}</span>}</div>
          </motion.button>
        ))}
        {rows?.length === 0 && <div className="glass p-10 text-center text-white/65">No reports submitted for {MONTHS[p.month - 1]} {p.year} yet.</div>}
      </div>

      </>}

      <Modal open={!!open} onClose={() => setOpen(null)} wide title={open ? `${open.names.parish ?? open.names.area ?? open.names.zone} · ${MONTHS[open.month - 1]} ${open.year}` : ""}>
        {open && (
          <div className="space-y-5 text-sm">
            <div className="flex flex-wrap items-center gap-2 text-xs"><span className="badge">{open.reportId ?? "No report ID"}</span><span className={REPORT_BADGE[open.status as ReportStatus]}>{REPORT_LABEL[open.status as ReportStatus]}</span>{open.revision > 1 && <span className="badge">Version {open.revision}</span>}<span className="text-white/65">Submitted {new Date(open.submittedAt).toLocaleString("en-NG")}</span></div>
            <div className="grid gap-3 sm:grid-cols-3">{[["Zone", open.names.zone], ["Area", open.names.area ?? "—"], ["Parish", open.names.parish ?? "—"]].map(([k, v]) => <div key={k}><p className="label">{k}</p><b>{v}</b></div>)}</div>
            {open.contact ? (
              <div className="rounded-2xl border border-brand/30 bg-brand/10 p-4">
                <p className="mb-2 text-xs font-black tracking-wider">ADMINISTRATOR'S CONTACT INFORMATION</p>
                <p className="font-bold">{open.contact.fullName}</p>
                <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1"><Tel n={open.contact.phone} />{open.contact.altPhone && <Tel n={open.contact.altPhone} />}</div>
                <p className="mt-2 text-[11px] text-white/65">As entered when this report was submitted.</p>
              </div>
            ) : <p className="rounded-xl bg-white/5 p-3 text-xs text-white/65">Contact details are visible to authorised administrators only.</p>}
            {open.remittance && <div className="rounded-xl bg-white/5 p-4"><p className="label">Youth Sunday remittance</p><p>Offering {formatNaira(open.remittance.offeringKobo)} · required <b>{formatNaira(open.remittance.requiredKobo)}</b> · confirmed <b>{formatNaira(open.remittance.confirmedKobo ?? 0)}</b>{open.remittance.outstandingKobo > 0 && <> · outstanding <b>{formatNaira(open.remittance.outstandingKobo)}</b></>} · <span className={statusBadge[open.remittance.status]}>{statusLabel[open.remittance.status]}</span></p></div>}
            {open.rollup && <div className="rounded-xl bg-white/5 p-4"><p className="label">Consolidation at submission</p><p className="text-white/70">{Object.entries(open.rollup).filter(([, v]) => typeof v === "number").map(([k, v]) => `${k.replace(/([A-Z])/g, " $1").toLowerCase()}: ${v}`).join(" · ")}</p></div>}
            <div className="space-y-3">{FIELDS[open.type as "parish"].map((f) => open.activity?.[f.key] !== undefined && open.activity?.[f.key] !== null && open.activity?.[f.key] !== "" ? <div key={f.key}><p className="label">{f.label}</p><p className="whitespace-pre-line text-white/80">{String(open.activity[f.key])}</p></div> : null)}</div>
            {open.reviews?.length > 0 && <div className="rounded-xl bg-white/5 p-4"><p className="label">Review log</p><ul className="space-y-1.5 text-xs">{[...open.reviews].reverse().map((v: any, i: number) => <li key={i}><b>{v.action.replace("_", " ")}</b> · {v.byName} · {new Date(v.at).toLocaleString("en-NG")}{v.note && <span className="text-white/65"> — {v.note}</span>}</li>)}</ul></div>}
            {canReview && <ReviewActions r={open} onDone={() => { setOpen(null); reload(); }} />}
            {open.history?.length > 0 && (
              <details className="rounded-xl bg-white/5 p-4"><summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-white/65">Revision history ({open.history.length}, read-only)</summary>
                <ul className="mt-3 space-y-3">{[...open.history].reverse().map((h: any, i: number) => (
                  <li key={i} className="rounded-lg border border-white/10 p-3 text-xs"><b>Version {h.revision}</b> · {new Date(h.at).toLocaleString("en-NG")}{h.byName && <> · {h.byName}</>}{h.note && <p className="mt-1 text-white/65">Reason for revision: {h.note}</p>}
                    {h.contact && <p className="mt-1 text-white/65">Contact then: {h.contact.fullName}, {h.contact.phone}{h.contact.altPhone ? `, ${h.contact.altPhone}` : ""}</p>}
                    <div className="mt-2 space-y-1">{FIELDS[open.type as "parish"].map((fd) => h.activity?.[fd.key] !== undefined && h.activity?.[fd.key] !== "" ? <p key={fd.key} className="text-white/65"><span className="text-white/65">{fd.label}:</span> {String(h.activity[fd.key])}</p> : null)}</div></li>
                ))}</ul></details>
            )}
            {canSubmit && <button className="btn btn-ghost" onClick={() => setRevising(open)}>Revise this report</button>}
          </div>
        )}
      </Modal>
      {revising && <ReviseModal r={revising} onClose={() => setRevising(null)} onDone={() => { setRevising(null); setOpen(null); reload(); }} />}
    </>
  );
}

function ReviseModal({ r, onClose, onDone }: { r: any; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [contact, setContact] = useState<Contact>({ fullName: r.contact?.fullName ?? "", phone: r.contact?.phone ?? "", altPhone: r.contact?.altPhone ?? "" });
  const [act, setAct] = useState<Record<string, string>>(Object.fromEntries(Object.entries(r.activity ?? {}).map(([k, v]) => [k, String(v ?? "")])));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const activity: Record<string, unknown> = {};
      for (const fd of FIELDS[r.type as "parish"]) { const v = act[fd.key] ?? ""; activity[fd.key] = fd.kind === "int" ? (v === "" ? "" : Number(v)) : v; }
      await api(`/api/reports/${r.id}`, { method: "PATCH", json: { contact, activity, note } });
      toast.ok("Report revised. The earlier version is kept in its history."); onDone();
    } catch (e: any) { toast.err(e.message); }
    setBusy(false);
  };
  return (
    <Modal open onClose={onClose} wide title={`Revise ${r.reportId ?? "report"}`}>
      <div className="space-y-5 text-sm">
        <p className="rounded-xl bg-white/5 p-3 text-xs text-white/65">Your earlier answers are not lost. They stay in the revision history. The financial section isn't changed here.</p>
        <ContactSection value={contact} onChange={setContact} />
        <ActivityFields fields={[...FIELDS[r.type as "parish"]]} values={act} onChange={(k, v) => setAct((a) => ({ ...a, [k]: v }))} />
        <div><label className="label" htmlFor="rev-note">Reason for revising (optional)</label><input id="rev-note" className="input" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} /></div>
        <div className="flex gap-2"><button className="btn btn-primary" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save revision"}</button><button className="btn btn-ghost" onClick={onClose}>Cancel</button></div>
      </div>
    </Modal>
  );
}

function ReviewActions({ r, onDone }: { r: any; onDone: () => void }) {
  const toast = useToast();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState("");
  const go = async (action: string) => {
    setBusy(action);
    try { await api(`/api/reports/${r.id}/review`, { method: "POST", json: { action, note } }); toast.ok("Done. The administrator has been notified."); onDone(); }
    catch (e: any) { toast.err(e.message); }
    setBusy("");
  };
  return (
    <div className="rounded-xl border border-white/10 p-4">
      <p className="label">Review this report</p>
      <p className="mb-2 text-xs text-white/65">This is about the activity report only. It doesn't change payment verification.</p>
      <input className="input mb-3" aria-label="Note for the administrator" placeholder="Note (required when asking for changes)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-primary btn-sm" disabled={!!busy} onClick={() => go("complete")}>Mark completed</button>
        <button className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => go("request_revision")}>Request revision</button>
        <button className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => go("mark_incomplete")}>Mark incomplete</button>
      </div>
    </div>
  );
}

function ComplianceView({ month, year, onPeriod }: { month: number; year: number; onPeriod: (m: number, y: number) => void }) {
  const toast = useToast();
  const [d, setD] = useState<any>(null);
  const [code, setCode] = useState("");
  useEffect(() => {
    setD(null);
    api(`/api/compliance?month=${month}&year=${year}`).then(setD).catch((e) => { toast.err(e.message); setD({ rows: [], counts: {} }); });
  }, [month, year, toast]);
  const rows = (d?.rows ?? []).filter((r: any) => !code || r.compliance.code === code);
  const labels: Record<string, string> = { fully_compliant: "Fully compliant", submitted_pending: "Report in, payment pending", submitted_discrepancy: "Report in, payment flagged", incomplete_activity: "Activity info missing", incomplete_financial: "Financial info missing", revision_requested: "Revision requested", not_submitted: "Not submitted" };
  return (
    <div className="space-y-4">
      <PeriodPicker month={month} year={year} onChange={onPeriod} />
      <p className="text-xs text-white/65">Fully compliant means the report is in <b>and</b> the remittance has been confirmed by finance. Pending, rejected or unverified payments are never counted as paid.</p>
      {d && <div className="flex flex-wrap gap-2">
        <button className={cn("badge", !code && "ring-1 ring-brand")} onClick={() => setCode("")}>All ({d.rows.length})</button>
        {Object.entries(d.counts).map(([k, n]) => <button key={k} className={cn("badge", code === k && "ring-1 ring-brand")} onClick={() => setCode(code === k ? "" : k)}>{labels[k] ?? k} ({n as number})</button>)}
      </div>}
      <div className="glass p-4">
        <DataTable<any>
          caption="Parish compliance for the selected month"
          rows={d ? rows : null} loading={!d} rowKey={(r) => r.id} pageSize={20}
          searchText={(r) => `${r.parish} ${r.zone ?? ""} ${r.area ?? ""}`} searchPlaceholder="Search parish, zone or area"
          empty={{ title: "No parishes match", hint: "Clear a filter to see more." }}
          columns={[
            { key: "parish", header: "Parish", sortValue: (r) => r.parish, render: (r) => <><b>{r.parish}</b><p className="text-xs text-white/75">{[r.zone, r.area].filter(Boolean).join(" → ")}</p></> },
            { key: "report", header: "Report", sortValue: (r) => r.reportStatus, render: (r) => <ReportBadge status={r.reportStatus} /> },
            { key: "pay", header: "Payment", sortValue: (r) => r.fv, render: (r) => <FinanceBadge status={r.fv} /> },
            { key: "req", header: "Required", align: "right", sortValue: (r) => r.requiredKobo, render: (r) => <span className="tabular-nums">{formatNaira(r.requiredKobo)}</span> },
            { key: "conf", header: "Confirmed", align: "right", sortValue: (r) => r.confirmedKobo, render: (r) => <span className="tabular-nums">{formatNaira(r.confirmedKobo)}</span> },
            { key: "out", header: "Outstanding", align: "right", sortValue: (r) => r.outstandingKobo, render: (r) => <span className="tabular-nums">{r.outstandingKobo ? formatNaira(r.outstandingKobo) : r.overpaidKobo ? `+${formatNaira(r.overpaidKobo)} over` : "—"}</span> },
            { key: "comp", header: "Compliance", sortValue: (r) => r.compliance.label, render: (r) => <><StatusBadge view={{ label: r.compliance.label, level: r.compliance.level }} />{r.compliance.detail && <p className="mt-1 text-[11px] text-white/75">{r.compliance.detail}</p>}</> },
          ]}
        />
      </div>
    </div>
  );
}
