"use client";
import { REPORT_BADGE, REPORT_LABEL, type ReportStatus } from "@/lib/verification";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Banknote, CheckCircle2, ClipboardList, Landmark, Loader2, Plus, Send, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/fetcher";
import { cn } from "@/lib/cn";
import { formatNaira, MONTHS, remittanceKobo, toKobo } from "@/lib/money";
import { FIELDS, type FieldDef } from "@/lib/report-config";
import { ActivityFields, ContactSection, EvidenceUpload, PeriodPicker, statusBadge, statusLabel, type Contact } from "./report-bits";

type Ctx = any;
const today = () => new Date().toISOString().slice(0, 10);

export function ReportWizard() {
  const toast = useToast();
  const router = useRouter();
  const now = new Date();
  const [period, setPeriod] = useState({ month: now.getMonth() + 1, year: now.getFullYear() });
  const [ctx, setCtx] = useState<Ctx>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [busy, setBusy] = useState(false);
  const [contact, setContact] = useState<Contact>({ fullName: "", phone: "", altPhone: "" });
  const [act, setAct] = useState<Record<string, string>>({});
  const [fin, setFin] = useState({ offering: "", paidAt: today(), amountPaid: "", reference: "", evidenceId: "", remarks: "" });
  const [levies, setLevies] = useState<{ category: string; description: string; amount: string; paidAt: string; reference: string; evidenceId: string }[]>([]);

  const load = useCallback(async () => {
    setCtx(null);
    try {
      const c = await api(`/api/reports/context?month=${period.month}&year=${period.year}`);
      setCtx(c);
      if (c.draft) {
        setAct((a) => (Object.keys(a).length ? a : Object.fromEntries(Object.entries(c.draft.activity ?? {}).map(([k, v]) => [k, String(v ?? "")]))));
        setContact((p) => ({ fullName: p.fullName || c.draft.contact?.fullName || "", phone: p.phone || c.draft.contact?.phone || "", altPhone: p.altPhone || c.draft.contact?.altPhone || "" }));
      }
      setContact((p) => ({ fullName: p.fullName || c.contact.fullName, phone: p.phone || c.contact.phone, altPhone: p.altPhone }));
      setStep(c.type === "parish" && c.remittance ? 2 : 1);
    } catch (e: any) { toast.err(e.message); setCtx({ error: e.message }); }
  }, [period, toast]);
  useEffect(() => { load(); }, [load]);

  if (!ctx) return <div className="space-y-4"><div className="skeleton h-28" /><div className="skeleton h-64" /></div>;
  if (ctx.error) return <div className="glass p-8 text-center text-white/60">{ctx.error}</div>;

  const fields: FieldDef[] = [...FIELDS[ctx.type as "parish" | "area" | "zone"]];
  const typeLabel = ({ parish: "Parish", area: "Area", zone: "Zonal" } as Record<string, string>)[ctx.type];
  const offeringKobo = toKobo(fin.offering || 0);
  const pct = (ctx.finance?.percentBp ?? 4000) / 100;
  const required = remittanceKobo(offeringKobo, ctx.finance?.percentBp ?? 4000);

  async function submitFinance() {
    if (!(Number(fin.offering) >= 0) || fin.offering === "") return toast.err("Enter the total Youth Sunday Thanksgiving offering (0 if none).");
    if (!fin.evidenceId) return toast.err("Please upload your payment evidence.");
    setBusy(true);
    try {
      await api("/api/remittances", { method: "POST", json: {
        ...period, offering: Number(fin.offering), paidAt: fin.paidAt, reference: fin.reference, evidenceId: fin.evidenceId, remarks: fin.remarks,
        ...(fin.amountPaid ? { amountPaid: Number(fin.amountPaid) } : {}),
        levies: levies.filter((l) => l.description || l.amount).map((l) => ({ category: l.category, description: l.description, amount: Number(l.amount), paidAt: l.paidAt, reference: l.reference, ...(l.evidenceId ? { evidenceId: l.evidenceId } : {}) })),
      } });
      toast.ok("Remittance recorded. Now complete your activity report.");
      await load(); setStep(2);
    } catch (e: any) { toast.err(e.message); }
    setBusy(false);
  }

  async function saveDraft() {
    setBusy(true);
    try {
      await api("/api/reports", { method: "PUT", json: { ...period, contact, activity: Object.fromEntries(Object.entries(act).map(([k, v]) => { const f = fields.find((x) => x.key === k); return [k, f?.kind === "int" ? (v.trim() === "" ? null : Number(v)) : v]; })) } });
      toast.ok("Draft saved. You can finish it later. It isn't submitted yet.");
    } catch (e: any) { toast.err(e.message); }
    setBusy(false);
  }

  async function submitReport() {
    const activity: Record<string, unknown> = {};
    for (const f of fields) {
      const raw = (act[f.key] ?? "").trim();
      if (f.kind === "int") {
        if (raw === "" && !f.optional) return toast.err(`${f.label}: enter a number (0 if none). A blank isn't counted as zero.`);
        activity[f.key] = raw === "" ? null : Number(raw);
      } else {
        if (raw === "" && !f.optional) return toast.err(`${f.label}: write NIL if there is nothing to report.`);
        activity[f.key] = raw;
      }
    }
    if (!contact.fullName.trim() || !contact.phone.trim()) return toast.err("Please complete the Administrator's Contact Information section.");
    setBusy(true);
    try { await api("/api/reports", { method: "POST", json: { ...period, contact, activity } }); toast.ok("Report submitted. Thank you!"); await load(); router.refresh(); }
    catch (e: any) { toast.err(e.message); }
    setBusy(false);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><PeriodPicker month={period.month} year={period.year} onChange={(month, year) => setPeriod({ month, year })} /></div>

      {/* Identity from database ids: names displayed prominently, never typed */}
      <div className="glass grid gap-4 p-5 sm:grid-cols-3">
        {[{ k: "Zone", v: ctx.names.zone }, ...(ctx.type !== "zone" ? [{ k: "Area", v: ctx.names.area ?? "— (standalone zone)" }] : []), ...(ctx.type === "parish" ? [{ k: "Parish", v: ctx.names.parish }] : []), { k: "Reporting period", v: `${MONTHS[period.month - 1]} ${period.year}` }].map((x) => (
          <div key={x.k}><p className="text-[11px] uppercase tracking-widest text-white/45">{ctx.type === "area" && x.k === "Area" ? "Name of Area" : x.k}</p><p className="mt-1 text-lg font-extrabold">{x.v}</p></div>
        ))}
      </div>

      {ctx.submitted ? (
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="glass p-8 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" />
          <p className="mt-3 text-lg font-bold">{typeLabel} report for {MONTHS[period.month - 1]} {period.year} has been submitted.</p>
          <p className="mt-1 text-sm text-white/50">Submitted {new Date(ctx.submitted.at).toLocaleString("en-NG")} · <span className={REPORT_BADGE[(ctx.submitted.status ?? "submitted") as ReportStatus]}>{REPORT_LABEL[(ctx.submitted.status ?? "submitted") as ReportStatus]}</span></p>
          {ctx.remittance && <p className="mt-3"><span className={statusBadge[ctx.remittance.status]}>{statusLabel[ctx.remittance.status]}</span></p>}
        </motion.div>
      ) : (
        <>
          {ctx.type === "parish" && (
            <div className="glass grid grid-cols-2 gap-1 p-1">
              {[{ n: 1, l: "1 · Finance", i: Banknote }, { n: 2, l: "2 · Activity report", i: ClipboardList }].map((s) => (
                <button data-needs-online key={s.n} disabled={s.n === 2 && !ctx.remittance} onClick={() => setStep(s.n as 1 | 2)} className={cn("relative rounded-xl py-2.5 text-sm font-semibold disabled:opacity-40", step === s.n ? "text-[#04130d]" : "text-white/60")}>
                  {step === s.n && <motion.span layoutId="wiz" className="absolute inset-0 rounded-xl bg-brand" />}<span className="relative flex items-center justify-center gap-2"><s.i className="h-4 w-4" />{s.l}</span>
                </button>
              ))}
            </div>
          )}

          <AnimatePresence mode="wait">
            {ctx.type === "parish" && step === 1 && (
              <motion.div key="fin" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
                {ctx.remittance ? (
                  <div className="glass p-6"><p className="font-bold">Finance already recorded for this month</p><p className="mt-2 text-sm text-white/60">Required remittance {formatNaira(ctx.remittance.requiredKobo)} · <span className={statusBadge[ctx.remittance.status]}>{statusLabel[ctx.remittance.status]}</span></p><button className="btn btn-primary mt-4" onClick={() => setStep(2)}>Continue to activity report<ArrowRight className="h-4 w-4" /></button></div>
                ) : (<>
                  <div className="glass p-5">
                    <p className="mb-3 flex items-center gap-2 font-bold"><Landmark className="h-4 w-4 text-accent" />Pay directly into the official provincial account</p>
                    {ctx.finance.bank.accountNumber ? (
                      <div className="grid gap-3 text-sm sm:grid-cols-3"><div><p className="label">Bank</p><b>{ctx.finance.bank.bankName}</b></div><div><p className="label">Account name</p><b>{ctx.finance.bank.accountName}</b></div><div><p className="label">Account number</p><b className="font-mono text-lg tracking-wider">{ctx.finance.bank.accountNumber}</b></div></div>
                    ) : <p className="badge-warn rounded-xl p-3 text-sm">Bank details haven't been published yet. Please contact the Provincial Finance Administrator.</p>}
                    {ctx.finance.bank.instructions && <p className="mt-3 text-xs text-white/50">{ctx.finance.bank.instructions}</p>}
                  </div>
                  <div className="glass space-y-4 p-5 sm:p-6">
                    <div><label className="label">Total Youth Sunday Thanksgiving offering collected (₦) <span className="text-accent">*</span></label><input className="input text-lg font-bold" type="number" inputMode="decimal" min={0} step="0.01" value={fin.offering} onChange={(e) => setFin({ ...fin, offering: e.target.value })} placeholder="0.00" /></div>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="rounded-xl bg-white/5 p-3"><p className="text-[10px] uppercase tracking-wider text-white/45">Offering</p><p className="mt-1 text-sm font-bold">{formatNaira(offeringKobo)}</p></div>
                      <motion.div key={required} initial={{ scale: 0.92 }} animate={{ scale: 1 }} className="rounded-xl border border-brand/40 bg-brand/15 p-3"><p className="text-[10px] uppercase tracking-wider text-brand">Remit {pct}%</p><p className="mt-1 text-sm font-black">{formatNaira(required)}</p></motion.div>
                      <div className="rounded-xl bg-white/5 p-3"><p className="text-[10px] uppercase tracking-wider text-white/45">Parish keeps</p><p className="mt-1 text-sm font-bold">{formatNaira(offeringKobo - required)}</p></div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div><label className="label">Date of payment <span className="text-accent">*</span></label><input className="input" type="date" max={today()} value={fin.paidAt} onChange={(e) => setFin({ ...fin, paidAt: e.target.value })} /></div>
                      <div><label className="label">Amount you paid (₦)</label><input className="input" type="number" step="0.01" min={0} value={fin.amountPaid} onChange={(e) => setFin({ ...fin, amountPaid: e.target.value })} placeholder={(required / 100).toFixed(2)} /><p className="hint">Leave blank if you paid the exact amount above.</p></div>
                      <div className="sm:col-span-2"><label className="label">Payment reference</label><input className="input" value={fin.reference} onChange={(e) => setFin({ ...fin, reference: e.target.value })} placeholder="Transfer reference, where available" /></div>
                    </div>
                    <EvidenceUpload value={fin.evidenceId} onChange={(id) => setFin({ ...fin, evidenceId: id })} />
                    <div><label className="label">Additional financial remarks</label><textarea className="input" rows={2} value={fin.remarks} onChange={(e) => setFin({ ...fin, remarks: e.target.value })} /></div>
                  </div>
                  <div className="glass space-y-3 p-5 sm:p-6">
                    <div><p className="font-bold">Other levies & contributions <span className="text-xs font-normal text-white/45">(optional · reported separately from the {pct}%)</span></p></div>
                    {levies.map((l, i) => (
                      <div key={i} className="space-y-3 rounded-xl border border-white/10 bg-white/[.03] p-4">
                        <div className="flex items-center justify-between"><p className="text-sm font-semibold">Levy {i + 1}</p><button className="btn btn-danger btn-sm !p-1.5" onClick={() => setLevies(levies.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5" /></button></div>
                        <select className="input" value={l.category} onChange={(e) => setLevies(levies.map((x, j) => j === i ? { ...x, category: e.target.value } : x))}><option value="levy">Levy (set by the province)</option><option value="contribution">Contribution (voluntary)</option></select>
                        <input className="input" placeholder="Description (e.g. Special provincial levy)" value={l.description} onChange={(e) => setLevies(levies.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} />
                        <div className="grid gap-3 sm:grid-cols-3"><input className="input" type="number" placeholder="Amount ₦" value={l.amount} onChange={(e) => setLevies(levies.map((x, j) => j === i ? { ...x, amount: e.target.value } : x))} /><input className="input" type="date" max={today()} value={l.paidAt} onChange={(e) => setLevies(levies.map((x, j) => j === i ? { ...x, paidAt: e.target.value } : x))} /><input className="input" placeholder="Reference" value={l.reference} onChange={(e) => setLevies(levies.map((x, j) => j === i ? { ...x, reference: e.target.value } : x))} /></div>
                        <EvidenceUpload label="Evidence (if required)" value={l.evidenceId} onChange={(id) => setLevies(levies.map((x, j) => j === i ? { ...x, evidenceId: id } : x))} />
                      </div>
                    ))}
                    <button className="btn btn-ghost w-full border-dashed" onClick={() => setLevies([...levies, { category: "levy", description: "", amount: "", paidAt: today(), reference: "", evidenceId: "" }])}><Plus className="h-4 w-4" />Add a levy or contribution</button>
                  </div>
                  <button data-needs-online className="btn btn-primary w-full py-3.5 text-base" disabled={busy} onClick={submitFinance}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}Save finance & continue to activity report</button>
                  <p className="text-center text-xs text-white/40">You don't need to wait for finance approval to complete your activity report.</p>
                </>)}
              </motion.div>
            )}

            {(ctx.type !== "parish" || step === 2) && (
              <motion.div key="act" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
                {ctx.rollup && <Rollup type={ctx.type} r={ctx.rollup} />}
                <div className="glass p-5 sm:p-6"><h3 className="mb-4 font-bold">{typeLabel} monthly activity report</h3><ActivityFields fields={fields} values={act} onChange={(k, v) => setAct((a) => ({ ...a, [k]: v }))} /></div>
                <ContactSection value={contact} onChange={setContact} />
                <button data-needs-online className="btn btn-primary w-full py-3.5 text-base" disabled={busy} onClick={submitReport}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Submit {typeLabel.toLowerCase()} report</button>
                <button data-needs-online className="btn btn-ghost w-full" disabled={busy} onClick={saveDraft}>Save as draft</button>
                {ctx.draft && <p className="text-center text-xs text-white/40">A saved draft was loaded. Drafts are not counted as submitted.</p>}
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}

function Rollup({ type, r }: { type: string; r: any }) {
  const Chip = ({ n, submitted }: { n: string; submitted: boolean }) => <span className={cn("badge", submitted ? "badge-ok" : "badge-warn")}>{submitted ? "✓" : "…"} {n}</span>;
  const stat = (l: string, v: number) => <div className="rounded-xl bg-white/5 p-3 text-center"><p className="text-2xl font-black">{v}</p><p className="text-[10px] uppercase tracking-wider text-white/45">{l}</p></div>;
  return (
    <div className="glass space-y-4 p-5 sm:p-6">
      <p className="font-bold">Auto-filled from the system</p>
      {type === "area" ? (
        <div className="grid grid-cols-3 gap-3">{stat("Parishes in area", r.parishCount)}{stat("Reports submitted", r.submittedParishReports)}{stat("Outstanding", r.outstandingParishReports)}</div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{stat("Areas", r.areaCount)}{stat("Parishes directly under zone", r.directParishCount)}{stat("Total parishes", r.totalParishes)}{stat("Parish reports in", r.submittedParishReports)}{stat("Parish reports outstanding", r.outstandingParishReports)}{stat("Area reports in", r.submittedAreaReports)}{stat("Area reports outstanding", r.outstandingAreaReports)}</div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {(type === "area" ? r.parishes : [...r.areas.map((a: any) => ({ ...a, name: `Area · ${a.name}` })), ...r.directParishes]).map((x: any) => <Chip key={x.id} n={x.name} submitted={x.submitted} />)}
      </div>
    </div>
  );
}
