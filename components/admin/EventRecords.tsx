"use client";
import { Download, Pencil, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { EventRecordFields } from "@/components/event/EventRecordFields";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/fetcher";
import { formatNaira } from "@/lib/money";

const LEVEL_WORD: Record<string, string> = { parish: "parish", area: "area", zone: "zone", province: "province" };

export function EventRecords({ role }: { role: string }) {
  const toast = useToast();
  const [forms, setForms] = useState<any[] | null>(null);
  const [formId, setFormId] = useState("");
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api("/api/event-forms").then((r) => {
      setForms(r.forms);
      const want = new URLSearchParams(window.location.search).get("form");
      setFormId(want && r.forms.some((f: any) => f.id === want) ? want : (r.forms.find((f: any) => f.status === "open") ?? r.forms[0])?.id ?? "");
    }).catch((e) => setErr(e.message));
  }, []);
  const load = useCallback(() => { if (!formId) return; setErr(""); return api(`/api/event-records?form=${formId}`).then(setD).catch((e) => setErr(e.message)); }, [formId]);
  useEffect(() => { setD(null); load(); }, [load]);

  async function save(unit: any, v: any) {
    setBusy(true);
    try { await api("/api/event-records", { method: "POST", json: { form: formId, unit: unit.id || undefined, ...v } }); toast.ok("Saved."); setEdit(null); await load(); }
    catch (e: any) { toast.err(e.message); }
    setBusy(false);
  }

  if (!forms && !err) return <div className="skeleton h-40" />;
  if (forms?.length === 0) return <div className="glass p-8 text-center text-sm text-white/70">{role === "super_admin" ? "No event forms yet. Make one under Event record forms." : "No event forms have been made yet."}</div>;
  const form = d?.form;
  const t = d?.totals;
  const units: any[] = (d?.units ?? []).filter((u: any) => !q.trim() || u.label.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <div><label className="label" htmlFor="ev-form">Event</label>
          <select id="ev-form" className="input" value={formId} onChange={(e) => setFormId(e.target.value)}>{forms?.map((f) => <option key={f.id} value={f.id}>{f.title}{f.status === "closed" ? " (closed)" : ""}</option>)}</select></div>
        {formId && <a className="btn btn-ghost self-end" href={`/api/event-records/export?form=${formId}`}><Download className="h-4 w-4" />Download spreadsheet</a>}
      </div>
      {err && <div className="glass p-5 text-center" role="alert"><p>{err}</p><button className="btn btn-primary mt-3" onClick={() => load()}>Try again</button></div>}
      {!d && !err && <div className="skeleton h-48" />}
      {d && form && t && (
        <>
          <section className="glass p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div><h2 className="text-lg font-bold">{form.title}</h2><p className="text-sm text-white/70">{new Date(form.eventDate).toLocaleDateString("en-NG", { dateStyle: "long" })}{form.venue ? ` · ${form.venue}` : ""} · one record per {LEVEL_WORD[form.level]}</p></div>
              <span className={`badge ${form.status === "open" ? "badge-ok" : "badge-warn"}`}>{form.status === "open" ? "Open" : "Closed"}</span>
            </div>
            {form.description && <p className="mt-2 text-sm text-white/70">{form.description}</p>}
            <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[["Males", t.males], ["Females", t.females], ["Total", t.total], ...(t.offeringKobo != null ? [["Offering", formatNaira(t.offeringKobo)]] : [])].map(([k, v]) => (
                <div key={String(k)} className="rounded-xl border border-white/10 p-3"><dt className="text-xs uppercase tracking-wider text-white/65">{k}</dt><dd className="mt-1 text-xl font-black tabular-nums">{typeof v === "number" ? v.toLocaleString("en-NG") : v}</dd></div>
              ))}
              {form.customFields.map((f: any) => <div key={f.key} className="rounded-xl border border-white/10 p-3"><dt className="text-xs uppercase tracking-wider text-white/65">{f.label}</dt><dd className="mt-1 text-xl font-black tabular-nums">{(t.extras[f.key] ?? 0).toLocaleString("en-NG")}</dd></div>)}
            </dl>
            <div className="mt-4"><div className="flex justify-between text-xs text-white/70"><span>Reported</span><span>{t.reported} of {t.expected}</span></div><div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={t.reported} aria-valuemax={t.expected}><div className="h-full rounded-full bg-gradient-to-r from-brand to-accent" style={{ width: `${t.expected ? Math.min(100, (t.reported / t.expected) * 100) : 0}%` }} /></div></div>
          </section>
          {d.units.length > 8 && <input className="input" placeholder={`Find a ${LEVEL_WORD[form.level]}…`} value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />}
          <ul className="space-y-2">
            {units.length === 0 && <li className="glass p-5 text-center text-sm text-white/65">{d.units.length === 0 ? `You aren't in charge of any ${LEVEL_WORD[form.level]} for this event.` : "No match."}</li>}
            {units.map((u) => (
              <li key={u.type + u.id} className="glass flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="font-semibold">{u.label}</p>
                  {u.record ? <p className="text-sm text-white/75"><strong className="tabular-nums">{u.record.total}</strong> total · {u.record.males} males · {u.record.females} females{form.collectOffering && u.record.offeringKobo != null ? ` · ${formatNaira(u.record.offeringKobo)}` : ""}</p> : <p className="text-sm text-amber-300">Not recorded yet</p>}
                  {u.record?.by && <p className="text-xs text-white/65">By {u.record.by}</p>}
                </div>
                {d.canFill && form.status === "open" && <button className="btn btn-sm btn-primary" onClick={() => setEdit(u)}>{u.record ? <><Pencil className="h-4 w-4" />Edit</> : <><Plus className="h-4 w-4" />Record</>}</button>}
              </li>
            ))}
          </ul>
          <Modal open={!!edit} onClose={() => setEdit(null)} title={edit ? `${form.title}: ${edit.name}` : ""}>
            {edit && <EventRecordFields form={form} initial={edit.record} busy={busy} onSubmit={(v) => save(edit, v)} note={edit.record ? `Last updated ${new Date(edit.record.updatedAt).toLocaleString("en-NG")}. Saving replaces these numbers, and the change is kept in the history.` : undefined} />}
          </Modal>
        </>
      )}
    </div>
  );
}
