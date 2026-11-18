"use client";
import { Loader2, Save } from "lucide-react";
import { useState } from "react";
import { formatNaira } from "@/lib/money";

export type EventFormDef = { id: string; title: string; level: string; collectOffering: boolean; customFields: { key: string; label: string }[] };
export type EventValues = { males: number | null; females: number | null; total?: number; offeringKobo?: number | null; extras?: Record<string, number>; notes?: string } | null;

const whole = (v: string) => (v.trim() === "" ? null : Number(v));

/** The numbers for one unit. The total is never typed: it shows men + women as you type, and the server works it out again when saved. */
export function EventRecordFields({ form, initial, busy, submitLabel = "Save record", onSubmit, note }: {
  form: EventFormDef; initial: EventValues; busy: boolean; submitLabel?: string; note?: string;
  onSubmit: (v: { males: number; females: number; offering?: number; extras: Record<string, number>; notes: string }) => void;
}) {
  const [males, setMales] = useState(initial?.males == null ? "" : String(initial.males));
  const [females, setFemales] = useState(initial?.females == null ? "" : String(initial.females));
  const [offering, setOffering] = useState(initial?.offeringKobo == null ? "" : String(initial.offeringKobo / 100));
  const [extras, setExtras] = useState<Record<string, string>>(Object.fromEntries(form.customFields.map((f) => [f.key, initial?.extras?.[f.key] == null ? "" : String(initial.extras[f.key])])));
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [err, setErr] = useState("");

  const m = whole(males), f = whole(females);
  const total = (m ?? 0) + (f ?? 0);
  const bad = (n: number | null) => n === null || !Number.isInteger(n) || n < 0;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (bad(m)) return setErr("Enter the number of males (0 if none).");
    if (bad(f)) return setErr("Enter the number of females (0 if none).");
    for (const x of form.customFields) if (bad(whole(extras[x.key] ?? ""))) return setErr(`Enter ${x.label} (0 if none).`);
    const o = whole(offering);
    if (form.collectOffering && (o === null || Number.isNaN(o) || o < 0)) return setErr("Enter the offering collected (0 if none).");
    setErr("");
    onSubmit({ males: m!, females: f!, ...(form.collectOffering ? { offering: o! } : {}), extras: Object.fromEntries(form.customFields.map((x) => [x.key, whole(extras[x.key])!])), notes });
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {note && <p className="rounded-xl border border-white/10 p-3 text-xs text-white/70">{note}</p>}
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label" htmlFor="ev-m">Males</label><input id="ev-m" className="input" inputMode="numeric" value={males} onChange={(e) => setMales(e.target.value.replace(/[^\d]/g, ""))} placeholder="0" /></div>
        <div><label className="label" htmlFor="ev-f">Females</label><input id="ev-f" className="input" inputMode="numeric" value={females} onChange={(e) => setFemales(e.target.value.replace(/[^\d]/g, ""))} placeholder="0" /></div>
      </div>
      <div className="rounded-xl border border-brand/40 bg-brand/10 p-3" aria-live="polite">
        <p className="text-xs uppercase tracking-wider text-white/65">Total (worked out for you)</p>
        <p className="text-3xl font-black tabular-nums">{total.toLocaleString("en-NG")}</p>
      </div>
      {form.customFields.map((x) => (
        <div key={x.key}><label className="label" htmlFor={`ev-${x.key}`}>{x.label}</label><input id={`ev-${x.key}`} className="input" inputMode="numeric" value={extras[x.key] ?? ""} onChange={(e) => setExtras({ ...extras, [x.key]: e.target.value.replace(/[^\d]/g, "") })} placeholder="0" /></div>
      ))}
      {form.collectOffering && (
        <div>
          <label className="label" htmlFor="ev-o">Offering collected (naira)</label>
          <input id="ev-o" className="input" inputMode="decimal" value={offering} onChange={(e) => setOffering(e.target.value.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1"))} placeholder="0" />
          {offering !== "" && !Number.isNaN(Number(offering)) && <p className="hint">That is {formatNaira(Math.round(Number(offering) * 100))}</p>}
        </div>
      )}
      <div><label className="label" htmlFor="ev-n">Notes <span className="font-normal text-white/65">(optional)</span></label><textarea id="ev-n" className="input min-h-[80px]" maxLength={600} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
      {err && <p className="text-sm text-red-300" role="alert">{err}</p>}
      <button className="btn btn-primary w-full py-3" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{submitLabel}</button>
    </form>
  );
}
