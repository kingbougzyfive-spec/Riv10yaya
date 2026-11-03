"use client";
import { motion } from "framer-motion";
import { Bot, ExternalLink, Landmark, Loader2, Percent } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/fetcher";
import { cn } from "@/lib/cn";
import { formatNaira, MONTHS } from "@/lib/money";
import { EvidenceUpload, PeriodPicker, statusBadge, statusLabel } from "./report-bits";

type Role = string;

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
    <>
      {settings && <Settings s={settings} onSaved={loadSettings} />}

      <div className="mb-4 mt-8 flex flex-wrap items-center gap-3">
        <PeriodPicker month={p.month} year={p.year} onChange={(month, year) => setP({ month, year })} />
        <select className="input !w-auto" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option>{Object.entries(statusLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <div className="glass ml-auto flex gap-1 p-1">{([["yst", "Youth Sunday 40%"], ["levy", "Other levies"]] as const).map(([k, l]) => <button key={k} onClick={() => setKind(k)} className={cn("relative rounded-xl px-4 py-2 text-sm font-semibold", kind === k ? "text-[#04130d]" : "text-white/60")}>{kind === k && <motion.span layoutId="fin-kind" className="absolute inset-0 rounded-xl bg-brand" />}<span className="relative">{l}</span></button>)}</div>
      </div>

      <div className="grid gap-3">
        {rows === null && [0, 1, 2].map((i) => <div key={i} className="skeleton h-24" />)}
        {rows?.map((r, i) => (
          <motion.button key={r.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.4) }} onClick={() => setSel(r)} className="glass glass-hover grid gap-3 p-4 text-left sm:grid-cols-[1.4fr_1fr_auto] sm:items-center">
            <div className="min-w-0"><p className="truncate font-bold">{r.parish}</p><p className="truncate text-xs text-white/45">{[r.zone, r.area].filter(Boolean).join(" → ")} · {MONTHS[r.month - 1]} {r.year}{r.description ? ` · ${r.description}` : ""}</p></div>
            <div className="text-sm">{r.kind === "yst" ? <><p>Required <b>{formatNaira(r.requiredKobo)}</b></p><p className="text-xs text-white/45">Paid {formatNaira(r.amountKobo)}{r.confirmedKobo != null ? ` · confirmed ${formatNaira(r.confirmedKobo)}` : ""}</p></> : <p>Amount <b>{formatNaira(r.amountKobo)}</b></p>}</div>
            <span className={statusBadge[r.status]}>{statusLabel[r.status]}</span>
          </motion.button>
        ))}
        {rows?.length === 0 && <div className="glass p-10 text-center text-white/45">No {kind === "yst" ? "remittances" : "levies"} for {MONTHS[p.month - 1]} {p.year}.</div>}
      </div>
      {sel && <Detail key={sel.id} r={sel} role={role} canReview={canReview} onClose={() => setSel(null)} onDone={() => { setSel(null); loadRows(); }} />}
    </>
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
          {s.canEditBank ? <button className="btn btn-primary" disabled={!!busy} onClick={() => save("bank")}>{busy === "bank" && <Loader2 className="h-4 w-4 animate-spin" />}Save bank details</button> : <p className="hint">Only finance administrators can change these.</p>}
        </div>
      </div>
      <div className="glass p-5">
        <p className="mb-3 flex items-center gap-2 font-bold"><Percent className="h-4 w-4 text-accent" />Remittance percentage</p>
        <div className="flex items-end gap-3"><div className="flex-1"><label className="label">Percent of Youth Sunday Thanksgiving</label><input className="input text-lg font-bold" type="number" step="0.01" min={0.01} max={100} disabled={!s.canEditPercent} value={pct} onChange={(e) => setPct(e.target.value)} /></div>{s.canEditPercent && <button className="btn btn-primary" disabled={!!busy} onClick={() => save("percent")}>{busy === "percent" && <Loader2 className="h-4 w-4 animate-spin" />}Update</button>}</div>
        <p className="hint">Applies to new submissions only. Each record keeps the percentage in force when it was submitted.</p>
        {s.history.length > 0 && <div className="mt-4 max-h-40 space-y-1.5 overflow-y-auto text-xs text-white/55">{s.history.map((h: any, i: number) => <p key={i}>{new Date(h.at).toLocaleDateString("en-NG")} · {h.byName} changed {h.field}: {h.from} → <b className="text-white/80">{h.to}</b></p>)}</div>}
      </div>
    </div>
  );
}

function Detail({ r, role, canReview, onClose, onDone }: { r: any; role: Role; canReview: boolean; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [note, setNote] = useState("");
  const [amount, setAmount] = useState(String(r.amountKobo / 100));
  const [ev, setEv] = useState("");
  const [busy, setBusy] = useState("");
  const [ai, setAi] = useState<any>(r.analysis ?? null);
  const readAi = async () => { setBusy("ai"); try { const x = await api(`/api/remittances/${r.id}/analyze`, { method: "POST" }); setAi(x.analysis); } catch (e: any) { toast.err(e.message); } setBusy(""); };
  const canRespond = role === "parish_admin" && ["needs_evidence", "rejected", "flagged"].includes(r.status);
  const act = async (action: string) => {
    setBusy(action);
    try { await api(`/api/remittances/${r.id}`, { method: "PATCH", json: { action, note, ...(action === "confirm" ? { confirmedAmount: Number(amount) } : {}), ...(ev ? { evidenceId: ev } : {}) } }); toast.ok("Done"); onDone(); }
    catch (e: any) { toast.err(e.message); }
    setBusy("");
  };
  const Btn = ({ a, l, cls }: { a: string; l: string; cls: string }) => <button className={cn("btn btn-sm", cls)} disabled={!!busy} onClick={() => act(a)}>{busy === a && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{l}</button>;
  return (
    <Modal open onClose={onClose} wide title={`${r.parish} · ${MONTHS[r.month - 1]} ${r.year}`}>
      <div className="space-y-5 text-sm">
        <div className="grid gap-3 sm:grid-cols-3">
          {r.kind === "yst" ? <><div><p className="label">Offering</p><b>{formatNaira(r.offeringKobo)}</b></div><div><p className="label">Required ({r.percentBp / 100}%)</p><b>{formatNaira(r.requiredKobo)}</b></div></> : <div className="sm:col-span-2"><p className="label">Levy</p><b>{r.description}</b></div>}
          <div><p className="label">Parish says it paid</p><b>{formatNaira(r.amountKobo)}</b></div>
          <div><p className="label">Paid on</p><b>{new Date(r.paidAt).toLocaleDateString("en-NG")}</b></div>
          <div><p className="label">Reference</p><b>{r.reference || "—"}</b></div>
          <div><p className="label">Status</p><span className={statusBadge[r.status]}>{statusLabel[r.status]}</span></div>
        </div>
        {r.remarks && <p className="rounded-xl bg-white/5 p-3 text-white/70">{r.remarks}</p>}
        {canReview && r.evidenceId && (
          <div className="rounded-2xl border border-white/10 bg-white/[.03] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white/60"><Bot className="h-4 w-4 text-accent" />AI receipt reading <span className="badge">advisory</span></p><button className="btn btn-ghost btn-sm" disabled={!!busy} onClick={readAi}>{busy === "ai" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{ai ? "Read again" : "Read receipt"}</button></div>
            {ai && (<div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
              <p>Amount on receipt: <b>{ai.amountNaira != null ? formatNaira(Math.round(ai.amountNaira * 100)) : "couldn't read"}</b> {ai.amountMatches === true && <span className="badge badge-ok">matches declared</span>}{ai.amountMatches === false && <span className="badge badge-bad">differs from declared {formatNaira(Math.round(ai.declaredNaira * 100))}</span>}</p>
              <p>Date: <b>{ai.date ?? "—"}</b></p>
              <p>Reference: <b>{ai.reference ?? "—"}</b> {ai.refMatches === true && <span className="badge badge-ok">matches</span>}{ai.refMatches === false && <span className="badge badge-warn">differs</span>}</p>
              <p>Bank: <b>{ai.bank ?? "—"}</b> · Confidence: <b>{ai.confidence}</b></p>
              {!ai.looksLikePaymentProof && <p className="badge-warn rounded-lg p-2 sm:col-span-2">This may not be a payment receipt.</p>}
              {ai.notes && <p className="text-white/60 sm:col-span-2">{ai.notes}</p>}
              <p className="text-[11px] text-white/35 sm:col-span-2">Automated reading can be wrong. Always compare with your bank statement before confirming.</p>
            </div>)}
          </div>
        )}
        {r.evidenceId && <a href={`/api/media/${r.evidenceId}`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost"><ExternalLink className="h-4 w-4" />View payment evidence</a>}
        <div><p className="label">History (cannot be edited)</p><ul className="space-y-2">{r.history.map((h: any, i: number) => <li key={i} className="rounded-xl bg-white/5 p-3 text-xs"><b className="capitalize">{h.action.replace("_", " ")}</b> · {h.byName} · {new Date(h.at).toLocaleString("en-NG")}{h.note && <p className="mt-1 text-white/65">{h.note}</p>}{h.evidenceId && <a className="mt-1 inline-block text-brand underline" target="_blank" rel="noopener noreferrer" href={`/api/media/${h.evidenceId}`}>Attached evidence</a>}</li>)}</ul></div>
        {canReview && r.status !== "confirmed" && (
          <div className="space-y-3 border-t border-white/10 pt-4">
            <div className="grid gap-3 sm:grid-cols-2"><div><label className="label">Amount seen in bank (₦)</label><input className="input" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></div><div><label className="label">Note (required unless confirming)</label><input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></div></div>
            <div className="flex flex-wrap gap-2"><Btn a="confirm" l="Confirm payment" cls="btn-primary" /><Btn a="request_evidence" l="Request more evidence" cls="btn-ghost" /><Btn a="flag" l="Flag as missing/mismatch" cls="btn-ghost" /><Btn a="reject" l="Reject" cls="btn-danger" /></div>
          </div>
        )}
        {canRespond && (
          <div className="space-y-3 border-t border-white/10 pt-4"><p className="font-bold">Respond to finance</p><textarea className="input" rows={3} placeholder="Explain or clarify…" value={note} onChange={(e) => setNote(e.target.value)} /><EvidenceUpload label="New evidence (optional)" value={ev} onChange={(id) => setEv(id)} /><Btn a="respond" l="Send response" cls="btn-primary" /></div>
        )}
      </div>
    </Modal>
  );
}
