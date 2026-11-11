"use client";
import { motion } from "framer-motion";
import { Eye, EyeOff, Loader2, Pin, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { api } from "@/lib/fetcher";
import { cn } from "@/lib/cn";
import { AreaField, ImageField, TextField, Toggle } from "./fields";

type Kind = "announcements" | "departments";

/** One manager for both content types: list, add, edit, publish/hide, delete. */
export function ContentManager({ kind }: { kind: Kind }) {
  const toast = useToast();
  const confirm = useConfirm();
  const isAnn = kind === "announcements";
  const [rows, setRows] = useState<any[] | null>(null);
  const [edit, setEdit] = useState<any | null>(null);
  const load = useCallback(() => api(`/api/${kind}`).then((r) => setRows(r.rows)).catch((e) => { toast.err(e.message); setRows([]); }), [kind, toast]);
  useEffect(() => { load(); }, [load]);
  const blank = isAnn ? { title: "", body: "", imageId: "", pinned: false, status: "draft", notify: true } : { name: "", description: "", headName: "", imageId: "", order: 0, active: true };
  const remove = async (r: any) => { if (!(await confirm({ title: `Delete "${r.title ?? r.name}"?`, confirmLabel: "Delete" }))) return; try { await api(`/api/${kind}/${r.id}`, { method: "DELETE" }); toast.ok("Deleted"); load(); } catch (e: any) { toast.err(e.message); } };
  const flip = async (r: any) => { try { await api(`/api/${kind}/${r.id}`, { method: "PATCH", json: isAnn ? { ...r, status: r.status === "published" ? "draft" : "published" } : { ...r, active: !r.active } }); toast.ok("Updated"); load(); } catch (e: any) { toast.err(e.message); } };
  return (
    <>
      <div className="mb-5 flex justify-end"><button className="btn btn-primary" onClick={() => setEdit({ ...blank })}><Plus className="h-4 w-4" />{isAnn ? "New announcement" : "New department"}</button></div>
      <div className="grid gap-3">
        {rows === null && [0, 1, 2].map((i) => <div key={i} className="skeleton h-20" />)}
        {rows?.map((r, i) => {
          const live = isAnn ? r.status === "published" : r.active;
          return (
            <motion.div key={r.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.4) }} className="glass flex flex-wrap items-center justify-between gap-3 p-4">
              <button className="min-w-0 flex-1 text-left" onClick={() => setEdit({ ...r })}>
                <p className="flex items-center gap-2 truncate font-bold">{r.pinned && <Pin className="h-3.5 w-3.5 text-accent" />}{r.title ?? r.name}</p>
                <p className="truncate text-xs text-white/65">{(r.body ?? r.description ?? "").slice(0, 110) || "No text yet"}</p>
              </button>
              <div className="flex items-center gap-2"><span className={cn("badge", live ? "badge-ok" : "badge-warn")}>{isAnn ? (live ? "Published" : "Draft") : live ? "Visible" : "Hidden"}</span>
                <button className="btn btn-ghost btn-sm" onClick={() => flip(r)}>{live ? <><EyeOff className="h-3.5 w-3.5" />{isAnn ? "Unpublish" : "Hide"}</> : <><Eye className="h-3.5 w-3.5" />{isAnn ? "Publish" : "Show"}</>}</button>
                <button className="btn btn-danger btn-sm !p-1.5" aria-label="Delete" onClick={() => remove(r)}><Trash2 className="h-3.5 w-3.5" /></button></div>
            </motion.div>
          );
        })}
        {rows?.length === 0 && <div className="glass p-10 text-center text-white/65">Nothing here yet.</div>}
      </div>
      {edit && <Form key={edit.id ?? "new"} kind={kind} init={edit} onClose={() => setEdit(null)} onDone={load} />}
    </>
  );
}

function Form({ kind, init, onClose, onDone }: { kind: Kind; init: any; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const isAnn = kind === "announcements";
  const [f, setF] = useState<any>(init);
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (v: any) => setF((x: any) => ({ ...x, [k]: v }));
  async function save() {
    setBusy(true);
    try {
      const { id, ...rest } = f;
      const json = isAnn ? { title: rest.title, body: rest.body, imageId: rest.imageId || "", pinned: !!rest.pinned, status: rest.status, notify: rest.notify !== false } : { name: rest.name, description: rest.description, headName: rest.headName, imageId: rest.imageId || "", order: Number(rest.order) || 0, active: !!rest.active };
      await api(id ? `/api/${kind}/${id}` : `/api/${kind}`, { method: id ? "PATCH" : "POST", json });
      toast.ok("Saved"); onClose(); onDone();
    } catch (e: any) { toast.err(e.message); }
    setBusy(false);
  }
  return (
    <Modal open onClose={onClose} wide title={`${f.id ? "Edit" : "New"} ${isAnn ? "announcement" : "department"}`}>
      <div className="space-y-4">
        {isAnn ? (<>
          <TextField label="Headline" value={f.title} onChange={set("title")} max={160} />
          <AreaField label="Message" rows={7} value={f.body} onChange={set("body")} max={8000} />
          <ImageField label="Image (optional)" value={f.imageId} onChange={set("imageId")} />
          <Toggle label="Pin to the top" checked={!!f.pinned} onChange={set("pinned")} />
          {!f.id && <Toggle label="Send a push notification when published" checked={f.notify !== false} onChange={set("notify")} />}
          <div><label className="label">Visibility</label><select className="input" value={f.status} onChange={(e) => set("status")(e.target.value)}><option value="draft">Draft (hidden)</option><option value="published">Published</option></select></div>
        </>) : (<>
          <TextField label="Department name" value={f.name} onChange={set("name")} max={100} />
          <AreaField label="What the department does" rows={5} value={f.description} onChange={set("description")} max={2000} />
          <TextField label="Head of department (name)" value={f.headName} onChange={set("headName")} />
          <ImageField label="Image (optional)" value={f.imageId} onChange={set("imageId")} />
          <TextField label="Display order (0 = first)" type="number" value={String(f.order)} onChange={set("order")} />
          <Toggle label="Visible on the website" checked={!!f.active} onChange={set("active")} />
        </>)}
        <button className="btn btn-primary w-full py-3" disabled={busy} onClick={save}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Save</button>
      </div>
    </Modal>
  );
}
