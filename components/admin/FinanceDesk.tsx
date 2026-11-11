"use client";
import { motion } from "framer-motion";
import { Bot, ExternalLink, Landmark, Loader2, Percent } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { api } from "@/lib/fetcher";
import { cn } from "@/lib/cn";
import { formatNaira, MONTHS } from "@/lib/money";
import { FV_LABEL, PROBLEM_STATUSES } from "@/lib/verification";
import { EvidenceUpload, PeriodPicker, statusBadge, statusLabel } from "./report-bits";

type Role = string;

/** false only when the server says AI receipt reading has no API key; until settings load we assume it is available. */
const AiAvailable = createContext(true);

export function FinanceDesk({ role }: { role: Role }) {
  const toast = useToast();
  const now = new Date();
  const [p, setP] = useState({ month: now.getMonth() + 1, year: now.getFullYear() });
  const [kind, setKind] = useState<"yst" | "levy">("yst");
  const [status, setStatus] = useState("");
  const [settings, setSettings] = useState<any>(null);
  const [rows, setRows] = useState<any[] | null>(null);
  const [sel, setSel] = useState<any>(null);
  const canReview = ["super_admin", "finance_admin"].includes(role);

  const loadSettings = useCallback(() => api("/api/finance/settings").then(setSettings).catch((e) => toast.err(e.message)), [toast]);
  const loadRows = useCallback(() => { setRows(null); api(`/api/remittances?month=${p.month}&year=${p.year}&kind=${kind}${status ? `&status=${status}` : ""}`).then((r) => setRows(r.rows)).catch((e) => { toast.err(e.message); setRows([]); }); }, [p, kind, status, toast]);
  useEffect(() => { loadSettings(); }, [loadSettings]);
  useEffect(() => { loadRows(); }, [loadRows]);

  return (
    <AiAvailable.Provider value={settings?.aiAvailable !== false}>
    <>
      {settings && <Settings s={settings} onSaved={loadSettings} />}

      <div className="mb-4 mt-8 flex flex-wrap items-center gap-3">
        <PeriodPicker month={p.month} year={p.year} onChange={(month, year) => setP({ month, year })} />
        <select className="input !w-auto" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option>{Object.entries(FV_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <div className="glass ml-auto flex gap-1 p-1">{([["yst", "Youth Sunday 40%"], ["levy", "Other levies"]] as const).map(([k, l]) => <button key={k} onClick={() => setKind(k)} className={cn("relative rounded-xl px-4 py-2 text-sm font-semibold", kind === k ? "text-[#04130d]" : "text-white/65")}>{kind === k && <motion.span layoutId="fin-kind" className="absolute inset-0 rounded-xl bg-brand" />}<span className="relative">{l}</span></button>)}</div>
      </div>

      <div className="grid gap-3">
        {rows === null && [0, 1, 2].map((i) => <div key={i} className="skeleton h-24" />)}
        {rows?.map((r, i) => (
          <motion.button key={r.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.4) }} onClick={() => setSel(r)} className="glass glass-hover grid gap-3 p-4 text-left sm:grid-cols-[1.4fr_1fr_auto] sm:items-center">
            <div className="min-w-0"><p className="truncate font-bold">{r.parish}</p><p className="truncate text-xs text-white/65">{[r.zone, r.area].filter(Boolean).join(" → ")} · {MONTHS[r.month - 1]} {r.year}{r.description ? ` · ${r.description}` : ""}</p></div>
            <div className="text-sm">{r.kind === "yst" ? <><p>Required <b>{formatNaira(r.requiredKobo)}</b></p><p className="text-xs text-white/65">Paid {formatNaira(r.totals.declaredKobo)} · confirmed {formatNaira(r.totals.confirmedKobo)}{r.totals.outstandingKobo > 0 ? ` · owing ${formatNaira(r.totals.outstandingKobo)}` : r.totals.overpaidKobo > 0 ? ` · over by ${formatNaira(r.totals.overpaidKobo)}` : ""}</p></> : <p>Amount <b>{formatNaira(r.amountKobo)}</b></p>}</div>
            <span className={statusBadge[r.fv]}>{statusLabel[r.fv]}</span>
          </motion.button>
        ))}
        {rows?.length === 0 && <div className="glass p-10 text-center text-white/65">No {kind === "yst" ? "remittances" : "levies"} for {MONTHS[p.month - 1]} {p.year}.</div>}
      </div>
      {sel && <Detail key={sel.id} r={sel} role={role} canReview={canReview} onClose={() => setSel(null)} onDone={() => { setSel(null); loadRows(); }} />}
    </>
    </AiAvailable.Provider>
  );
}

function Settings({ s, onSaved }: { s: any; onSaved: () => void }) {
  const toast = useToast();
  const [pct, setPct] = useState(String(s.percentBp / 100));
  const [bank, setBank] = useState(s.bank);
  const [busy, setBusy] = useState("");
  const save = async (what: "percent" | "bank") => {
    setBusy(what);
    try { await api("/api/finance/settings", { method: "PUT", json: what === "percent" ? { percent: Number(pct) } : { bank } }); toast.ok("Saved and logged"); onSaved(); }
    catch (e: any) { toast.err(e.message); }
    setBusy("");
  };
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="glass p-5">
        <p className="mb-3 flex items-center gap-2 font-bold"><Landmark className="h-4 w-4 text-accent" />Official provincial account</p>
        <div className="space-y-3">
          {([["bankName", "Bank"], ["accountName", "Account name"], ["accountNumber", "Account number (10 digits)"]] as const).map(([k, l]) => <div key={k}><label className="label">{l}</label><input className="input" disabled={!s.canEditBank} value={bank[k]} onChange={(e) => setBank({ ...bank, [k]: e.target.value })} /></div>)}
          <div><label className="label">Payment instructions</label><textarea className="input" rows={2} disabled={!s.canEditBank} value={bank.instructions} onChange={(e) => setBank({ ...bank, instructions: e.target.value })} /></div>
          {s.canEditBank ? <button data-needs-online className="btn btn-primary" disabled={!!busy} onClick={() => save("bank")}>{busy === "bank" && <Loader2 className="h-4 w-4 animate-spin" />}Save bank details</button> : <p className="hint">Only finance administrators can change these.</p>}
        </div>
      </div>
      <div className="glass p-5">
        <p className="mb-3 flex items-center gap-2 font-bold"><Percent className="h-4 w-4 text-accent" />Remittance percentage</p>
        <div className="flex items-end gap-3"><div className="flex-1"><label className="label">Percent of Youth Sunday Thanksgiving</label><input className="input text-lg font-bold" type="number" step="0.01" min={0.01} max={100} disabled={!s.canEditPercent} value={pct} onChange={(e) => setPct(e.target.value)} /></div>{s.canEditPercent && <button data-needs-online className="btn btn-primary" disabled={!!busy} onClick={() => save("percent")}>{busy === "percent" && <Loader2 className="h-4 w-4 animate-spin" />}Update</button>}</div>
        <p className="hint">Applies to new submissions only. Each record keeps the percentage in force when it was submitted.</p>
        {s.history.length > 0 && <div className="mt-4 max-h-40 space-y-1.5 overflow-y-auto text-xs text-white/65">{s.history.map((h: any, i: number) => <p key={i}>{new Date(h.at).toLocaleDateString("en-NG")} · {h.byName} changed {h.field}: {h.from} → <b className="text-white/80">{h.to}</b></p>)}</div>}
      </div>
    </div>
  );
}

function Detail({ r, role, canReview, onClose, onDone }: { r: any; role: Role; canReview: boolean; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState("");
  const isParish = role === "parish_admin";
  const t = r.totals;
  // The original payment plus any additional payments toward the same obligation.
  const pays = [
    { id: undefined as string | undefined, label: "Payment 1", status: r.status, amountKobo: r.amountKobo, confirmedKobo: r.confirmedKobo, seenKobo: r.seenKobo, paidAt: r.paidAt, reference: r.reference, remarks: r.remarks, evidenceId: r.evidenceId, analysis: r.analysis, flags: r.flags, history: r.history },
    ...r.payments.map((x: any, n: number) => ({ ...x, label: `Payment ${n + 2}` })),
  ];
  const act = async (body: Record<string, unknown>, key: string) => {
    setBusy(key);
    try { await api(`/api/remittances/${r.id}`, { method: "PATCH", json: body }); toast.ok("Saved. The history has been updated."); onDone(); }
    catch (e: any) { toast.err(e.message); }
    setBusy("");
  };
  return (
    <Modal open onClose={onClose} wide title={`${r.parish} · ${MONTHS[r.month - 1]} ${r.year}`}>
      <div className="space-y-5 text-sm">
        <div className="grid gap-3 sm:grid-cols-3">
          {r.kind === "yst" ? <><div><p className="label">Offering</p><b>{formatNaira(r.offeringKobo)}</b></div><div><p className="label">Required ({r.percentBp / 100}%)</p><b>{formatNaira(r.requiredKobo)}</b></div></> : <div className="sm:col-span-2"><p className="label">Levy</p><b>{r.description}</b></div>}
          <div><p className="label">Overall payment status</p><span className={statusBadge[r.fv]}>{statusLabel[r.fv]}</span></div>
          <div><p className="label">Declared by parish</p><b>{formatNaira(t.declaredKobo)}</b></div>
          <div><p className="label">Confirmed by finance</p><b>{formatNaira(t.confirmedKobo)}</b></div>
          {r.kind === "yst" && <div><p className="label">{t.overpaidKobo ? "Overpaid" : "Outstanding balance"}</p><b className={t.outstandingKobo ? "text-accent" : ""}>{formatNaira(t.overpaidKobo || t.outstandingKobo)}</b></div>}
        </div>
        {r.kind === "yst" && <p className="text-xs text-white/65">Only money confirmed against the receiving account counts. The obligation is paid only when confirmed payments (plus audited adjustments) reach the required amount.</p>}

        {pays.map((pay) => <PaymentCard key={pay.id ?? "root"} r={r} pay={pay} canReview={canReview} isParish={isParish} act={act} busy={busy} />)}

        {r.adjustments.length > 0 && <div><p className="label">Manual adjustments (permanent)</p><ul className="space-y-2">{r.adjustments.map((a: any, i: number) => <li key={i} className="rounded-xl bg-white/5 p-3 text-xs"><b>{a.amountKobo > 0 ? "+" : ""}{formatNaira(a.amountKobo)}</b> · {a.byName} · {new Date(a.at).toLocaleString("en-NG")}<p className="mt-1 text-white/65">{a.reason}</p></li>)}</ul></div>}

        {canReview && r.kind === "yst" && <Adjust act={act} busy={busy} />}
        {isParish && r.kind === "yst" && !t.satisfied && <AddPayment r={r} onDone={onDone} />}
      </div>
    </Modal>
  );
}

function PaymentCard({ r, pay, canReview, isParish, act, busy }: { r: any; pay: any; canReview: boolean; isParish: boolean; act: (b: Record<string, unknown>, k: string) => void; busy: string }) {
  const toast = useToast();
  const confirm = useConfirm();
  const aiAvailable = useContext(AiAvailable);
  const [ai, setAi] = useState<any>(pay.analysis ?? null);
  const [f, setF] = useState({ amount: String(pay.amountKobo / 100), seen: "", ref: "", reason: "", note: "", ev: "" });
  const [aiBusy, setAiBusy] = useState(false);
  const fv = ai && pay.status === "submitted" ? "ai_examined" : pay.status === "submitted" ? "receipt_uploaded" : pay.status;
  const problem = PROBLEM_STATUSES.includes(pay.status);
  const key = pay.id ?? "root";
  const readAi = async () => { setAiBusy(true); try { const x = await api(`/api/remittances/${r.id}/analyze${pay.id ? `?paymentId=${pay.id}` : ""}`, { method: "POST" }); setAi(x.analysis); } catch (e: any) { toast.err(e.message); } setAiBusy(false); };
  const base = { paymentId: pay.id };
  const ASK: Record<string, { title: string; message: string; confirmLabel: string; tone?: "danger" | "default" }> = {
    confirm: { title: "Confirm this payment?", message: "Only confirm after checking the receiving bank statement. A confirmation cannot be undone in the app; mistakes are corrected by an audited adjustment.", confirmLabel: "Confirm payment", tone: "default" },
    payment_not_found: { title: "Mark payment as not found?", message: "The parish will be told and asked to respond. This is recorded in the audit log.", confirmLabel: "Mark not found" },
    amount_mismatch: { title: "Flag an amount mismatch?", message: "The parish will be told the amounts differ. This is recorded in the audit log.", confirmLabel: "Flag mismatch" },
    rejected: { title: "Reject this payment?", message: "The parish will be told it was rejected. This is recorded in the audit log.", confirmLabel: "Reject" },
  };
  const decide = async (action: string) => { const q = ASK[action]; if (q && !(await confirm(q))) return; decideNow(action); };
  const decideNow = (action: string) => act({ ...base, action, reason: f.reason, note: f.note, bankReference: f.ref, ...(f.ev ? { evidenceId: f.ev } : {}), ...(action === "confirm" ? { confirmedAmount: Number(f.amount) } : {}), ...(action === "amount_mismatch" && f.seen ? { seenAmount: Number(f.seen) } : {}) }, `${key}-${action}`);
  const B = ({ a, l, cls }: { a: string; l: string; cls: string }) => <button data-needs-online className={cn("btn btn-sm", cls)} disabled={!!busy} onClick={() => decide(a)}>{busy === `${key}-${a}` && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{l}</button>;
  return (
    <section className="space-y-4 rounded-2xl border border-white/10 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-bold">{pay.label}</p><span className={statusBadge[fv]}>{statusLabel[fv]}</span></div>
      <div className="grid gap-3 sm:grid-cols-4">
        <div><p className="label">Parish says it paid</p><b>{formatNaira(pay.amountKobo)}</b></div>
        <div><p className="label">Paid on</p><b>{new Date(pay.paidAt).toLocaleDateString("en-NG")}</b></div>
        <div><p className="label">Reference</p><b>{pay.reference || "—"}</b></div>
        <div><p className="label">{pay.status === "confirmed" ? "Confirmed" : pay.seenKobo != null ? "Amount finance found" : "Confirmed"}</p><b>{pay.status === "confirmed" ? formatNaira(pay.confirmedKobo ?? 0) : pay.seenKobo != null ? formatNaira(pay.seenKobo) : "—"}</b></div>
      </div>
      {pay.remarks && <p className="rounded-xl bg-white/5 p-3 text-white/70">{pay.remarks}</p>}
      {pay.status === "payment_not_found" && <p className="rounded-xl p-3 text-xs badge-warn">Payment not found: financial verification outstanding. This is an open verification issue, not a finding that nothing was paid. The monthly report is unaffected.</p>}

      {(pay.flags?.length > 0 || ai?.flags?.length > 0) && (
        <div className="rounded-2xl border border-white/10 bg-white/[.03] p-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-white/65">Points to check <span className="badge">for human review</span></p>
          <ul className="space-y-2">{[...(pay.flags ?? []).filter((x: any) => !(ai?.flags ?? []).some((a: any) => a.code === x.code)), ...(ai?.flags ?? [])].map((x: any, i: number) => (
            <li key={i} className={cn("rounded-lg p-2.5 text-xs", x.level === "alert" ? "badge-bad" : x.level === "warn" ? "badge-warn" : "bg-white/5 text-white/65")}><b>{x.label}</b>{x.detail && <p className="mt-0.5 opacity-80">{x.detail}</p>}</li>
          ))}</ul>
          <p className="mt-2 text-[11px] text-white/65">These are prompts, not findings. A flag does not mean anyone did something wrong, and no flags does not prove the money arrived. Confirm against the bank statement.</p>
        </div>
      )}

      {canReview && pay.evidenceId && (
        <div className="rounded-2xl border border-white/10 bg-white/[.03] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white/65"><Bot className="h-4 w-4 text-accent" />AI receipt reading <span className="badge">advisory</span></p>{aiAvailable && <button data-needs-online className="btn btn-ghost btn-sm" disabled={aiBusy} onClick={readAi}>{aiBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{ai ? "Read again" : "Read receipt"}</button>}</div>
          {!aiAvailable && <p role="note" className="mt-2 rounded-xl border border-amber-400/30 bg-amber-400/5 p-3 text-xs">AI receipt reading is not configured (no <code>ANTHROPIC_API_KEY</code>). Nothing is being read automatically. Check the receipt yourself against the bank statement before confirming.</p>}
          {ai && (<div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
            <p>Amount on receipt: <b>{ai.amountNaira != null ? formatNaira(Math.round(ai.amountNaira * 100)) : "couldn't read"}</b> {ai.amountMatches === true && <span className="badge badge-ok">matches declared</span>}{ai.amountMatches === false && <span className="badge badge-bad">differs from declared {formatNaira(Math.round(ai.declaredNaira * 100))}</span>}</p>
            <p>Date: <b>{ai.date ?? "—"}</b> · Time: <b>{ai.time ?? "—"}</b></p>
            <p>Reference: <b>{ai.reference ?? "—"}</b> {ai.refMatches === true && <span className="badge badge-ok">matches</span>}{ai.refMatches === false && <span className="badge badge-warn">differs</span>}</p>
            <p>Bank: <b>{ai.bank ?? "—"}</b> · Confidence: <b>{ai.confidence}</b></p>
            <p>Paid to: <b>{ai.beneficiaryName ?? "—"}</b>{ai.beneficiaryAccount ? ` · ${ai.beneficiaryAccount}` : ""}</p>
            <p>Sender: <b>{ai.payerName ?? "—"}</b> · Status on receipt: <b>{ai.transactionStatus ?? "—"}</b></p>
            {ai.notes && <p className="text-white/65 sm:col-span-2">{ai.notes}</p>}
            <p className="text-[11px] text-white/65 sm:col-span-2">Automated reading can be wrong. Always compare with your bank statement before confirming.</p>
          </div>)}
        </div>
      )}

      {pay.evidenceId && <a href={`/api/media/${pay.evidenceId}`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm"><ExternalLink className="h-4 w-4" />View original receipt</a>}
      <div><p className="label">History (cannot be edited or deleted)</p>
        <ul className="space-y-2">{pay.history.map((h: any, i: number) => (
          <li key={i} className="rounded-xl bg-white/5 p-3 text-xs"><b className="capitalize">{h.action.replaceAll("_", " ")}</b> · {h.byName} · {new Date(h.at).toLocaleString("en-NG")}
            {h.amountKobo != null && <span> · {formatNaira(h.amountKobo)}</span>}{h.reference && <span> · bank ref {h.reference}</span>}
            {h.reason && <p className="mt-1 text-white/75">Reason: {h.reason}</p>}{h.note && <p className="mt-1 text-white/65">{h.note}</p>}
            {h.evidenceId && <a className="mt-1 inline-block text-brand underline" target="_blank" rel="noopener noreferrer" href={`/api/media/${h.evidenceId}`}>Attached evidence</a>}</li>
        ))}</ul></div>

      {canReview && pay.status !== "confirmed" && (
        <div className="space-y-3 border-t border-white/10 pt-4">
          <p className="text-xs font-bold uppercase tracking-wider text-white/65">Finance verification</p>
          <p className="text-xs text-white/65">Compare with the actual receiving account statement, not just the receipt.</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div><label className="label">Amount found in account (₦)</label><input className="input" type="number" step="0.01" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></div>
            <div><label className="label">Bank / transaction reference</label><input className="input" value={f.ref} onChange={(e) => setF({ ...f, ref: e.target.value })} /></div>
            <div><label className="label">Different amount seen (₦, if mismatch)</label><input className="input" type="number" step="0.01" value={f.seen} onChange={(e) => setF({ ...f, seen: e.target.value })} /></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="label">Reason (required unless confirming)</label><input className="input" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></div>
            <div><label className="label">Remarks</label><input className="input" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></div>
          </div>
          <EvidenceUpload label="Attach statement extract or other evidence (optional)" value={f.ev} onChange={(id) => setF({ ...f, ev: id })} />
          <div className="flex flex-wrap gap-2">
            {pay.status === "submitted" && <B a="begin_review" l="Begin verification" cls="btn-ghost" />}
            <B a="confirm" l="Confirm payment" cls="btn-primary" /><B a="payment_not_found" l="Payment not found" cls="btn-ghost" /><B a="amount_mismatch" l="Amount mismatch" cls="btn-ghost" /><B a="request_resubmission" l="Request resubmission" cls="btn-ghost" /><B a="reject" l="Reject" cls="btn-danger" />
          </div>
        </div>
      )}
      {isParish && problem && (
        <div className="space-y-3 border-t border-white/10 pt-4"><p className="font-bold">Respond to finance</p><textarea className="input" rows={3} placeholder="Add transaction details or explain…" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /><EvidenceUpload label="Additional evidence (optional). Your original receipt stays on file." value={f.ev} onChange={(id) => setF({ ...f, ev: id })} />
          <button data-needs-online className="btn btn-primary btn-sm" disabled={!!busy} onClick={() => act({ ...base, action: "respond", note: f.note, ...(f.ev ? { evidenceId: f.ev } : {}) }, `${key}-respond`)}>{busy === `${key}-respond` && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Send response</button></div>
      )}
    </section>
  );
}

function Adjust({ act, busy }: { act: (b: Record<string, unknown>, k: string) => void; busy: string }) {
  const [a, setA] = useState({ amount: "", reason: "", ref: "", ev: "" });
  return (
    <details className="rounded-2xl border border-white/10 p-4"><summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-white/65">Manual financial adjustment</summary>
      <div className="mt-3 space-y-3">
        <p className="text-xs text-white/65">Use only for corrections that can't be recorded as a payment (for example a verified offline payment or a credit carried forward). A reason is mandatory and the entry can never be removed.</p>
        <div className="grid gap-3 sm:grid-cols-3"><div><label className="label">Amount (₦, negative to reduce)</label><input className="input" type="number" step="0.01" value={a.amount} onChange={(e) => setA({ ...a, amount: e.target.value })} /></div><div className="sm:col-span-2"><label className="label">Reason (required)</label><input className="input" value={a.reason} onChange={(e) => setA({ ...a, reason: e.target.value })} /></div></div>
        <EvidenceUpload label="Supporting evidence (optional)" value={a.ev} onChange={(id) => setA({ ...a, ev: id })} />
        <button data-needs-online className="btn btn-ghost btn-sm" disabled={!!busy || !a.amount || a.reason.length < 5} onClick={() => act({ action: "adjust", adjustAmount: Number(a.amount), reason: a.reason, ...(a.ev ? { evidenceId: a.ev } : {}) }, "adjust")}>{busy === "adjust" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Record adjustment</button>
      </div>
    </details>
  );
}

function AddPayment({ r, onDone }: { r: any; onDone: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ amount: String(r.totals.outstandingKobo / 100), paidAt: new Date().toISOString().slice(0, 10), reference: "", evidenceId: "", remarks: "" });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!f.evidenceId) return toast.err("Upload the payment evidence first.");
    setBusy(true);
    try { await api(`/api/remittances/${r.id}/payments`, { method: "POST", json: { amountPaid: Number(f.amount), paidAt: f.paidAt, reference: f.reference, evidenceId: f.evidenceId, remarks: f.remarks } }); toast.ok("Additional payment submitted for verification."); onDone(); }
    catch (e: any) { toast.err(e.message); }
    setBusy(false);
  };
  return (
    <details className="rounded-2xl border border-white/10 p-4"><summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-white/65">Make another payment toward this remittance (balance {formatNaira(r.totals.outstandingKobo)})</summary>
      <div className="mt-3 space-y-3">
        <p className="text-xs text-white/65">Pay into the same official provincial account, then upload the receipt. It counts only after finance confirms it.</p>
        <div className="grid gap-3 sm:grid-cols-3"><div><label className="label">Amount paid (₦)</label><input className="input" type="number" step="0.01" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></div><div><label className="label">Date of payment</label><input className="input" type="date" value={f.paidAt} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setF({ ...f, paidAt: e.target.value })} /></div><div><label className="label">Reference</label><input className="input" value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} /></div></div>
        <EvidenceUpload value={f.evidenceId} onChange={(id) => setF({ ...f, evidenceId: id })} />
        <input className="input" placeholder="Remarks (optional)" value={f.remarks} onChange={(e) => setF({ ...f, remarks: e.target.value })} />
        <button data-needs-online className="btn btn-primary btn-sm" disabled={busy} onClick={save}>{busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Submit payment</button>
      </div>
    </details>
  );
}
