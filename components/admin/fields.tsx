"use client";
import { ImageIcon, Plus, Trash2, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { MediaPickerModal } from "./Media";
import { mediaUrl } from "@/lib/site-types";
import { cn } from "@/lib/cn";

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (<div><label className="label">{label}</label>{children}{hint && <p className="hint">{hint}</p>}</div>);
}

export function TextField(p: { label: string; value: string; onChange: (v: string) => void; hint?: string; placeholder?: string; max?: number; type?: string }) {
  return (
    <Field label={p.label} hint={p.hint}>
      <input className="input" type={p.type || "text"} value={p.value} placeholder={p.placeholder} maxLength={p.max} onChange={(e) => p.onChange(e.target.value)} />
    </Field>
  );
}

export function AreaField(p: { label: string; value: string; onChange: (v: string) => void; hint?: string; rows?: number; max?: number }) {
  return (
    <Field label={p.label} hint={p.hint}>
      <textarea className="input resize-y leading-relaxed" rows={p.rows || 4} value={p.value} maxLength={p.max} onChange={(e) => p.onChange(e.target.value)} />
      {p.max && <p className="mt-1 text-right text-[10px] text-white/30">{p.value.length}/{p.max}</p>}
    </Field>
  );
}

export function ColorField({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  return (
    <Field label={label} hint={hint}>
      <div className="flex items-center gap-3">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-11 w-14 cursor-pointer rounded-xl border border-white/15 bg-transparent p-1" />
        <input className="input font-mono" value={value} onChange={(e) => onChange(e.target.value)} maxLength={7} />
      </div>
    </Field>
  );
}

export function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex w-full items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left transition hover:bg-white/10" role="switch" aria-checked={checked}>
      <span><span className="block text-sm font-medium">{label}</span>{hint && <span className="block text-xs text-white/45">{hint}</span>}</span>
      <span className={cn("relative h-6 w-11 shrink-0 rounded-full transition", checked ? "bg-brand" : "bg-white/20")}>
        <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", checked ? "left-[22px]" : "left-0.5")} />
      </span>
    </button>
  );
}

export function ImageField({ label, value, onChange, hint, round }: { label: string; value: string; onChange: (id: string) => void; hint?: string; round?: boolean }) {
  const [open, setOpen] = useState(false);
  const url = mediaUrl(value);
  return (
    <Field label={label} hint={hint}>
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => setOpen(true)} className={cn("group relative grid h-20 w-20 shrink-0 place-items-center overflow-hidden border border-dashed border-white/20 bg-white/5 transition hover:border-brand", round ? "rounded-full" : "rounded-2xl")}>
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" className="h-full w-full object-cover" />
          ) : <ImageIcon className="h-6 w-6 text-white/35 transition group-hover:text-brand" />}
        </button>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>{url ? "Change" : "Choose image"}</button>
          {url && <button type="button" className="btn btn-danger btn-sm" onClick={() => onChange("")}><X className="h-3.5 w-3.5" />Remove</button>}
        </div>
      </div>
      <MediaPickerModal open={open} onClose={() => setOpen(false)} onPick={onChange} current={value} />
    </Field>
  );
}

export function RepeatList<T>({ items, onChange, render, blank, addLabel, max, title }: {
  items: T[]; onChange: (items: T[]) => void; render: (item: T, set: (patch: Partial<T>) => void, i: number) => ReactNode; blank: T; addLabel: string; max?: number; title: (item: T, i: number) => string;
}) {
  return (
    <div className="space-y-3">
      {items.map((it, i) => (
        <details key={i} open={i === items.length - 1 && items.length < 3} className="glass group rounded-2xl p-0">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
            <span className="truncate text-sm font-semibold">{title(it, i) || `Item ${i + 1}`}</span>
            <button type="button" className="btn btn-danger btn-sm !p-1.5" aria-label="Remove" onClick={(e) => { e.preventDefault(); onChange(items.filter((_, j) => j !== i)); }}><Trash2 className="h-3.5 w-3.5" /></button>
          </summary>
          <div className="space-y-4 border-t border-white/10 p-4">{render(it, (patch) => onChange(items.map((x, j) => (j === i ? { ...x, ...patch } : x))), i)}</div>
        </details>
      ))}
      {(!max || items.length < max) && (
        <button type="button" className="btn btn-ghost w-full border-dashed" onClick={() => onChange([...items, structuredClone(blank)])}><Plus className="h-4 w-4" />{addLabel}</button>
      )}
    </div>
  );
}
