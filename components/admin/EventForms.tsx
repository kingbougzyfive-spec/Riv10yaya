"use client";
import { CalendarDays, Loader2, Lock, LockOpen, Pencil, Plus, Table2, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/fetcher";

const LEVELS = [["parish", "Each parish"], ["area", "Each area"], ["zone", "Each zone"], ["province", "One for the whole province"]] as const;
const blank = { title: "", description: "", eventDate: "", endDate: "", venue: "", level: "parish", collectOffering: true, customFields: [] as { label: string }[] };
const day = (d?: string | null) => (d ? new Date(d).toISOString().slice(0, 10) : "");

export function EventForms() {
  const toast = useToast();
  const confirm = useConfirm();
  const [forms, setForms] = useState<any[] | null>(null);
  const [err, setErr] = useState("");
  const [dlg, setDlg] = useState<{ edit?: any } | null>(null);
  const [f, setF] = useState(blank);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => api("/api/event-forms").then((r) => { setForms(r.forms); setErr(""); }).catch((e) => setErr(e.message)), []);
  useEffect(() => { load(); }, [load]);

  const open = (edit?: any) => {
    setF(edit ? { title: edit.title, description: edit.description, eventDate: day(edit.eventDate), endDate: day(edit.endDate), venue: edit.venue, level: edit.level, collectOffering: edit.collectOffering, customFields: edit.customFields.map((c: any) => ({ label: c.label })) } : blank);
    setDlg({ edit });
  };
  const locked = !!dlg?.edit && dlg.edit.records > 0; // once records exist, the fields can't change under them

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (dlg?.edit) await api("/api/event-forms", { method: "PATCH", json: { id: dlg.edit.id, ...f, endDate: f.endDate } });
      else await api("/api/event-forms", { method: "POST", json: f });
      toast.ok(dlg?.edit ? "Saved." : "Event form created."); setDlg(null); await load();
    } catch (er: any) { toast.err(er.message); }
    setBusy(false);
  }
  async function setStatus(x: any, status: "open" | "closed") {
    if (status === "closed" && !(await confirm({ title: `Close "${x.title}"?`, message: "Nobody can add or change records after it is closed. You can reopen it later.", confirmLabel: "Close form" }))) return;
    try { await api("/api/event-forms", { method: "PATCH", json: { id: x.id, status } }); await load(); } catch (er: any) { toast.err(er.message); }
  }
  async function remove(x: any) {
    if (!(await confirm({ title: `Delete "${x.title}"?`, message: "This form has no records, so nothing is lost. This can't be undone.", confirmLabel: "Delete" }))) return;
    try { await api(`/api/event-forms?id=${x.id}`, { method: "DELETE" }); await load(); } catch (er: any) { toast.err(er.message); }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><button className="btn btn-primary" onClick={() => open()}><Plus className="h-4 w-4" />New event form</button></div>
      {!forms && !err && <div className="skeleton h-28" />}
      {err && <div className="glass p-5 text-center" role="alert"><p>{err}</p><button className="btn btn-primary mt-3" onClick={load}>Try again</button></div>}
      {forms?.length === 0 && <div className="glass p-8 text-center text-sm text-white/70">No event forms yet. Make one for a special event, then people in charge of parishes, areas and zones can record their numbers.</div>}
      {forms?.map((x) => (
        <article key={x.id} className="glass space-y-2 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0"><p className="font-semibold">{x.title}</p><p className="flex items-center gap-1.5 text-xs text-white/65"><CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />{new Date(x.eventDate).toLocaleDateString("en-NG", { dateStyle: "medium" })}{x.venue ? ` · ${x.venue}` : ""}</p></div>
            <span className={`badge ${x.status === "open" ? "badge-ok" : "badge-warn"}`}>{x.status === "open" ? "Open" : "Closed"}</span>
          </div>
          <p className="text-xs text-white/70">One record per {x.level === "province" ? "province (a single record)" : x.level} · Males, females, total{x.collectOffering ? ", offering" : ""}{x.customFields.length ? ` · plus ${x.customFields.map((c: any) => c.label).join(", ")}` : ""} · <strong>{x.records}</strong> record{x.records === 1 ? "" : "s"} so far</p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Link className="btn btn-sm btn-primary" href={`/admin/event-records?form=${x.id}`}><Table2 className="h-4 w-4" />Records & totals</Link>
            <button className="btn btn-sm btn-ghost" onClick={() => open(x)}><Pencil className="h-4 w-4" />Edit</button>
            {x.status === "open" ? <button className="btn btn-sm btn-ghost" onClick={() => setStatus(x, "closed")}><Lock className="h-4 w-4" />Close</button> : <button className="btn btn-sm btn-ghost" onClick={() => setStatus(x, "open")}><LockOpen className="h-4 w-4" />Reopen</button>}
            {x.records === 0 && <button className="btn btn-sm btn-ghost" onClick={() => remove(x)}><Trash2 className="h-4 w-4" />Delete</button>}
          </div>
        </article>
      ))}

      <Modal open={!!dlg} onClose={() => setDlg(null)} title={dlg?.edit ? "Edit event form" : "New event form"}>
        <form onSubmit={submit} className="space-y-4">
          <div><label className="label">Name of the event</label><input className="input" required minLength={3} maxLength={120} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Youth Convention 2026" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Date</label><input className="input" type="date" required value={f.eventDate} onChange={(e) => setF({ ...f, eventDate: e.target.value })} /></div>
            <div><label className="label">Ends <span className="font-normal text-white/65">(optional)</span></label><input className="input" type="date" min={f.eventDate} value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} /></div>
          </div>
          <div><label className="label">Venue <span className="font-normal text-white/65">(optional)</span></label><input className="input" maxLength={120} value={f.venue} onChange={(e) => setF({ ...f, venue: e.target.value })} /></div>
          <div><label className="label">Short description <span className="font-normal text-white/65">(optional)</span></label><textarea className="input min-h-[70px]" maxLength={600} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
          <fieldset disabled={locked} className="space-y-3 disabled:opacity-60">
            <legend className="label">Who records the numbers?</legend>
            <div className="grid grid-cols-2 gap-2" role="radiogroup">{LEVELS.map(([v, l]) => <button type="button" key={v} role="radio" aria-checked={f.level === v} onClick={() => setF({ ...f, level: v })} className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${f.level === v ? "border-brand bg-brand/20" : "border-white/15 text-white/75 hover:bg-white/5"}`}>{l}</button>)}</div>
            <div className="rounded-xl border border-white/10 p-3 text-sm"><p className="font-semibold">Always recorded</p><p className="text-white/70">Males, females, and the total (worked out automatically).</p></div>
            <label className="flex min-h-[44px] items-center gap-3 rounded-xl border border-white/10 px-3 py-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[rgb(var(--brand))]" checked={f.collectOffering} onChange={(e) => setF({ ...f, collectOffering: e.target.checked })} />Also record the offering collected at this event</label>
            <div>
              <p className="label">Extra counts <span className="font-normal text-white/65">(optional, e.g. First timers, Salvations)</span></p>
              <ul className="space-y-2">{f.customFields.map((c, i) => (
                <li key={i} className="flex gap-2"><input className="input" maxLength={60} required minLength={2} placeholder="Name of the count" value={c.label} onChange={(e) => setF({ ...f, customFields: f.customFields.map((x, j) => (j === i ? { label: e.target.value } : x)) })} aria-label={`Extra count ${i + 1}`} /><button type="button" className="btn btn-ghost btn-sm" onClick={() => setF({ ...f, customFields: f.customFields.filter((_, j) => j !== i) })} aria-label="Remove this count"><X className="h-4 w-4" /></button></li>
              ))}</ul>
              {f.customFields.length < 8 && <button type="button" className="btn btn-ghost btn-sm mt-2" onClick={() => setF({ ...f, customFields: [...f.customFields, { label: "" }] })}><Plus className="h-4 w-4" />Add a count</button>}
            </div>
          </fieldset>
          {locked && <p className="hint">Records have already been submitted, so the level, the offering and the extra counts are locked. Names and dates can still change.</p>}
          <button className="btn btn-primary w-full py-3" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{dlg?.edit ? "Save changes" : "Create form"}</button>
        </form>
      </Modal>
    </div>
  );
}
