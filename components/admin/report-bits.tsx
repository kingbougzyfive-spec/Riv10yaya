"use client";
import { FV_BADGE, FV_LABEL } from "@/lib/verification";
import { CheckCircle2, FileUp, Loader2, Phone, X } from "lucide-react";
import { useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/fetcher";
import { MONTHS } from "@/lib/money";
import type { FieldDef } from "@/lib/report-config";

export function PeriodPicker({ month, year, onChange }: { month: number; year: number; onChange: (m: number, y: number) => void }) {
  const y0 = new Date().getFullYear();
  return (
    <div className="flex gap-2">
      <select className="input !w-auto" value={month} onChange={(e) => onChange(Number(e.target.value), year)} aria-label="Month">{MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select>
      <select className="input !w-auto" value={year} onChange={(e) => onChange(month, Number(e.target.value))} aria-label="Year">{[y0 + 1, y0, y0 - 1, y0 - 2].map((y) => <option key={y}>{y}</option>)}</select>
    </div>
  );
}

/** Private evidence upload: receipts are never public. */
export function EvidenceUpload({ value, onChange, label = "Payment evidence" }: { value: string; onChange: (id: string, name: string) => void; label?: string }) {
  const toast = useToast();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  async function pick(f?: File) {
    if (!f) return;
    setBusy(true);
    try {
      const fd = new FormData(); fd.append("file", f);
      const r = await api("/api/evidence", { method: "POST", body: fd });
      setName(r.name); onChange(r.id, r.name); toast.ok("Evidence uploaded");
    } catch (e: any) { toast.err(e.message); }
    setBusy(false);
  }
  return (
    <div>
      <label className="label">{label}</label>
      <input ref={ref} type="file" accept="image/*,application/pdf" capture={undefined} hidden onChange={(e) => pick(e.target.files?.[0])} />
      {value ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm">
          <span className="flex min-w-0 items-center gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" /><span className="truncate">{name || "Uploaded"}</span></span>
          <button type="button" onClick={() => { onChange("", ""); setName(""); }} aria-label="Remove"><X className="h-4 w-4 text-white/65 hover:text-white" /></button>
        </div>
      ) : (
        <button type="button" onClick={() => ref.current?.click()} disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-white/15 px-4 py-4 text-sm text-white/65 transition hover:border-brand hover:text-white">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}{busy ? "Uploading…" : "Upload receipt or screenshot (JPG, PNG, PDF · max 4 MB)"}
        </button>
      )}
    </div>
  );
}

/** Renders the activity fields from the shared config. Blank numeric fields stay blank (never 0). */
export function ActivityFields({ fields, values, onChange }: { fields: FieldDef[]; values: Record<string, string>; onChange: (k: string, v: string) => void }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {fields.map((f) => (
        <div key={f.key} className={f.kind === "int" ? "" : "sm:col-span-2"}>
          <label className="label">{f.label}{!f.optional && <span className="text-accent"> *</span>}</label>
          {f.kind === "int" ? (
            <input className="input" type="number" inputMode="numeric" min={0} step={1} value={values[f.key] ?? ""} onChange={(e) => onChange(f.key, e.target.value)} />
          ) : (
            <textarea className="input resize-y" rows={f.kind === "long" ? 3 : 2} value={values[f.key] ?? ""} onChange={(e) => onChange(f.key, e.target.value)} />
          )}
          {f.hint && <p className="hint">{f.hint}</p>}
        </div>
      ))}
    </div>
  );
}

export type Contact = { fullName: string; phone: string; altPhone: string };

/** The dedicated section every Parish, Area and Zonal report must contain. */
export function ContactSection({ value, onChange }: { value: Contact; onChange: (c: Contact) => void }) {
  return (
    <section className="glass p-5 sm:p-6">
      <h3 className="mb-1 flex items-center gap-2 text-sm font-black tracking-wider"><Phone className="h-4 w-4 text-accent" />ADMINISTRATOR'S CONTACT INFORMATION</h3>
      <p className="mb-4 text-xs text-white/65">Confirm these details each month. They're saved with this report so provincial leaders can call you directly. They are never shown publicly.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><label className="label">Full name of administrator submitting the report <span className="text-accent">*</span></label><input className="input" autoComplete="name" value={value.fullName} onChange={(e) => onChange({ ...value, fullName: e.target.value })} /></div>
        <div><label className="label">Active phone number <span className="text-accent">*</span></label><input className="input" type="tel" inputMode="tel" autoComplete="tel" placeholder="0803 000 0000" value={value.phone} onChange={(e) => onChange({ ...value, phone: e.target.value })} /></div>
        <div><label className="label">Alternative phone number</label><input className="input" type="tel" inputMode="tel" placeholder="Optional" value={value.altPhone} onChange={(e) => onChange({ ...value, altPhone: e.target.value })} /></div>
      </div>
    </section>
  );
}

// Payment status keys (stored and derived) share one set of labels. "submitted" is a freshly uploaded receipt.
export const statusBadge: Record<string, string> = { ...FV_BADGE, submitted: "badge" };
export const statusLabel: Record<string, string> = { ...FV_LABEL, submitted: "Receipt uploaded" };
