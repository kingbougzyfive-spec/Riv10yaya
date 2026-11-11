"use client";
import { motion } from "framer-motion";
import { CalendarPlus, Eye, EyeOff, Loader2, Pencil, Users, XCircle } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { api } from "@/lib/fetcher";
import { fmtDT, fromLocalInput, toLocalInput } from "@/lib/dates";
import { AreaField, ImageField, RepeatList, TextField, Toggle } from "./fields";

const blank = { title: "", description: "", venue: "", mapUrl: "", startsAt: "", endsAt: "", registrationDeadline: "", capacity: "0", eligibility: "", organizers: "", contactName: "", contactPhone: "", contactEmail: "", flyerId: "", status: "draft", registrationOpen: true, customFields: [] as any[], recFreq: "none", recCount: "4" };

export function EventsManager({ canManage }: { canManage: boolean }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [events, setEvents] = useState<any[] | null>(null);
  const [edit, setEdit] = useState<any | null>(null);
  const load = useCallback(() => api("/api/events").then((r) => setEvents(r.events)).catch((e) => toast.err(e.message)), [toast]);
  useEffect(() => { load(); }, [load]);
  const quick = async (id: string, body: any, ok: string) => { try { await api(`/api/events/${id}`, { method: "PATCH", json: { quick: true, ...body } }); toast.ok(ok); load(); } catch (e: any) { toast.err(e.message); } };
  const badge = (s: string) => (s === "published" ? "badge-ok" : s === "cancelled" ? "badge-bad" : "badge-warn");

  return (
    <>
      {canManage && <div className="mb-5 flex justify-end"><button className="btn btn-primary" onClick={() => setEdit({ ...blank })}><CalendarPlus className="h-4 w-4" />New event</button></div>}
      <div className="grid gap-3">
        {events === null && [0, 1, 2].map((i) => <div key={i} className="skeleton h-24" />)}
        {events?.map((e, i) => (
          <motion.div key={e.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.4) }} className="glass flex flex-wrap items-center justify-between gap-4 p-4">
            <div className="min-w-0"><p className="truncate font-bold">{e.title}</p><p className="text-xs text-white/65">{fmtDT(e.startsAt)}{e.venue ? ` · ${e.venue}` : ""}</p></div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`badge ${badge(e.status)} capitalize`}>{e.status}</span>
              <span className="badge"><Users className="h-3 w-3" />{e.registered}{e.capacity ? `/${e.capacity}` : ""} · {e.attended} in</span>
              <Link href={`/admin/events/${e.id}`} className="btn btn-ghost btn-sm">Registrations</Link>
              {canManage && <>
                <button className="btn btn-ghost btn-sm" onClick={() => setEdit({ ...e, startsAt: toLocalInput(e.startsAt), endsAt: toLocalInput(e.endsAt), registrationDeadline: toLocalInput(e.registrationDeadline), capacity: String(e.capacity ?? 0), customFields: e.customFields ?? [], recFreq: "none", recCount: "4", _id: e.id })}><Pencil className="h-3.5 w-3.5" /></button>
                {e.status !== "published" ? <button className="btn btn-ghost btn-sm" onClick={() => quick(e.id, { status: "published" }, "Published")}><Eye className="h-3.5 w-3.5" />Publish</button> : <button className="btn btn-ghost btn-sm" onClick={() => quick(e.id, { status: "draft" }, "Unpublished")}><EyeOff className="h-3.5 w-3.5" />Unpublish</button>}
                {e.status !== "cancelled" && <button className="btn btn-danger btn-sm" onClick={async () => (await confirm({ title: "Cancel this event?", message: "Registrants will see it as cancelled.", confirmLabel: "Cancel event", cancelLabel: "Keep event" })) && quick(e.id, { status: "cancelled" }, "Cancelled")}><XCircle className="h-3.5 w-3.5" /></button>}
              </>}
            </div>
          </motion.div>
        ))}
        {events?.length === 0 && <div className="glass p-10 text-center text-white/65">No events yet.</div>}
      </div>
      {edit && <EventForm key={edit._id ?? "new"} init={edit} onClose={() => setEdit(null)} onDone={load} />}
    </>
  );
}

function EventForm({ init, onClose, onDone }: { init: any; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [f, setF] = useState<any>(init);
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (v: any) => setF((x: any) => ({ ...x, [k]: v }));
  async function save() {
    setBusy(true);
    try {
      const body: any = { title: f.title, description: f.description, venue: f.venue, mapUrl: f.mapUrl, startsAt: fromLocalInput(f.startsAt), endsAt: fromLocalInput(f.endsAt), registrationDeadline: fromLocalInput(f.registrationDeadline), capacity: Number(f.capacity) || 0, eligibility: f.eligibility, organizers: f.organizers, contactName: f.contactName, contactPhone: f.contactPhone, contactEmail: f.contactEmail, flyerId: f.flyerId || "", status: f.status, registrationOpen: f.registrationOpen, customFields: (f.customFields ?? []).map((c: any) => ({ key: c.key, label: c.label, type: c.type, required: !!c.required, options: c.type === "select" ? (c.options ?? []) : [] })) };
      if (!f._id && f.recFreq !== "none") body.recurrence = { freq: f.recFreq, count: Number(f.recCount) };
      if (f._id) await api(`/api/events/${f._id}`, { method: "PATCH", json: body }); else await api("/api/events", { method: "POST", json: body });
      toast.ok(f._id ? "Event saved" : "Event created"); onClose(); onDone();
    } catch (e: any) { toast.err(e.message); }
    setBusy(false);
  }
  return (
    <Modal open onClose={onClose} wide title={f._id ? "Edit event" : "New event"}>
      <div className="space-y-4">
        <TextField label="Title" value={f.title} onChange={set("title")} max={140} />
        <AreaField label="Description" rows={5} value={f.description} onChange={set("description")} max={5000} />
        <ImageField label="Flyer" hint="Shown on the events list and event page." value={f.flyerId} onChange={set("flyerId")} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Venue" value={f.venue} onChange={set("venue")} /><TextField label="Map link (optional)" value={f.mapUrl} onChange={set("mapUrl")} placeholder="https://maps.google.com/…" />
          <div><label className="label">Starts</label><input className="input" type="datetime-local" value={f.startsAt} onChange={(e) => set("startsAt")(e.target.value)} /></div>
          <div><label className="label">Ends</label><input className="input" type="datetime-local" value={f.endsAt} onChange={(e) => set("endsAt")(e.target.value)} /></div>
          <div><label className="label">Registration deadline</label><input className="input" type="datetime-local" value={f.registrationDeadline} onChange={(e) => set("registrationDeadline")(e.target.value)} /></div>
          <TextField label="Capacity (0 = unlimited)" type="number" value={f.capacity} onChange={set("capacity")} />
          <TextField label="Who can attend" value={f.eligibility} onChange={set("eligibility")} placeholder="e.g. Ages 18–35" /><TextField label="Organisers" value={f.organizers} onChange={set("organizers")} />
          <TextField label="Contact name" value={f.contactName} onChange={set("contactName")} /><TextField label="Contact phone" value={f.contactPhone} onChange={set("contactPhone")} />
          <div className="sm:col-span-2"><TextField label="Contact email" value={f.contactEmail} onChange={set("contactEmail")} /></div>
        </div>
        <div><p className="label">Extra registration questions</p>
          <RepeatList items={f.customFields} onChange={set("customFields")} blank={{ key: "", label: "", type: "text", required: false, options: [] }} addLabel="Add a question" max={12} title={(c: any) => c.label}
            render={(c: any, s: any) => (<>
              <div className="grid gap-3 sm:grid-cols-2"><TextField label="Question" value={c.label} onChange={(v) => s({ label: v, key: c.key || v.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/^(\d)/, "q$1").slice(0, 30) })} />
                <div><label className="label">Answer type</label><select className="input" value={c.type} onChange={(e) => s({ type: e.target.value })}><option value="text">Short text</option><option value="select">Choose from list</option><option value="yesno">Yes / No</option></select></div></div>
              {c.type === "select" && <TextField label="Options (comma separated)" value={(c.options ?? []).join(", ")} onChange={(v) => s({ options: v.split(",").map((x) => x.trim()).filter(Boolean) })} />}
              <Toggle label="Required" checked={!!c.required} onChange={(v) => s({ required: v })} />
            </>)} /></div>
        <Toggle label="Registration open" checked={f.registrationOpen} onChange={set("registrationOpen")} />
        <div><label className="label">Visibility</label><select className="input" value={f.status} onChange={(e) => set("status")(e.target.value)}><option value="draft">Draft (hidden)</option><option value="published">Published</option><option value="cancelled">Cancelled</option></select></div>
        {!f._id && <div className="grid gap-4 sm:grid-cols-2"><div><label className="label">Repeat</label><select className="input" value={f.recFreq} onChange={(e) => set("recFreq")(e.target.value)}><option value="none">Doesn't repeat</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></div>{f.recFreq !== "none" && <TextField label="How many times" type="number" value={f.recCount} onChange={set("recCount")} />}</div>}
        <button className="btn btn-primary w-full py-3" disabled={busy} onClick={save}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Save event</button>
      </div>
    </Modal>
  );
}
