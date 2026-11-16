"use client";
import { Search, X } from "lucide-react";
import { useMemo, useState } from "react";

export type PickOption = { id: string; label: string };
const SHOW = 60;

/**
 * Pick any number of items from a long list: type to narrow it, tick the ones you want, and see what you picked as chips you can remove.
 * Built for phones: big tap targets, and the list scrolls inside its own box.
 */
export function UnitPicker({ title, hint, options, value, onChange, disabled, emptyText }: {
  title: string; hint?: string; options: PickOption[]; value: string[]; onChange: (ids: string[]) => void; disabled?: boolean; emptyText?: string;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const byId = useMemo(() => new Map(options.map((o) => [o.id, o])), [options]);
  const chosen = new Set(value);
  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    return (n ? options.filter((o) => o.label.toLowerCase().includes(n)) : options);
  }, [options, q]);
  const toggle = (id: string) => onChange(chosen.has(id) ? value.filter((x) => x !== id) : [...value, id]);

  return (
    <div className="rounded-2xl border border-white/10 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{title} <span className="font-normal text-white/65">({value.length} chosen)</span></p>
        <button type="button" disabled={disabled} onClick={() => setOpen((v) => !v)} className="btn btn-ghost btn-sm" aria-expanded={open}>{open ? "Done" : "Add or remove"}</button>
      </div>
      {hint && <p className="mt-1 text-xs text-white/65">{hint}</p>}
      {value.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={`${title} chosen`}>
          {value.map((id) => (
            <li key={id} className="flex max-w-full items-center gap-1 rounded-full border border-brand/40 bg-brand/15 py-0.5 pl-3 pr-1 text-xs">
              <span className="truncate">{byId.get(id)?.label ?? "(unknown)"}</span>
              <button type="button" onClick={() => toggle(id)} aria-label={`Remove ${byId.get(id)?.label ?? "item"}`} className="grid h-6 w-6 place-items-center rounded-full hover:bg-white/10"><X className="h-3.5 w-3.5" /></button>
            </li>
          ))}
        </ul>
      )}
      {open && (
        <div className="mt-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/65" aria-hidden="true" />
            <input className="input pl-9" placeholder={`Search ${title.toLowerCase()}…`} value={q} onChange={(e) => setQ(e.target.value)} aria-label={`Search ${title}`} />
          </div>
          <ul className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-white/10" role="listbox" aria-multiselectable="true" aria-label={title}>
            {shown.length === 0 && <li className="p-3 text-sm text-white/65">{options.length === 0 ? emptyText ?? "Nothing to choose yet." : "No match. Try fewer letters."}</li>}
            {shown.slice(0, SHOW).map((o) => (
              <li key={o.id} role="option" aria-selected={chosen.has(o.id)}>
                <label className="flex min-h-[44px] cursor-pointer items-center gap-3 border-b border-white/5 px-3 py-2 text-sm last:border-0 hover:bg-white/5">
                  <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--brand))]" checked={chosen.has(o.id)} onChange={() => toggle(o.id)} />
                  <span>{o.label}</span>
                </label>
              </li>
            ))}
            {shown.length > SHOW && <li className="p-3 text-xs text-white/65">Showing the first {SHOW} of {shown.length}. Type to narrow the list.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
