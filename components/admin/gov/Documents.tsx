"use client";
import { FileText, Loader2, Lock, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/fetcher";
import { LEVEL_LABEL, LEVELS } from "@/lib/governance";
import { defaultOrg, Field, fmt, LevelBadge, OrgPicker, type Me, type OrgVal } from "./shared";

const CATS = ["minutes", "policy", "report", "letter", "other"];
const size = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export function Documents({ me, canEdit }: { me: Me; canEdit: boolean }) {
  const toast = useToast();
  const [rows, setRows] = useState<any[] | null>(null);
  const [cat, setCat] = useState("");
  const [lv, setLv] = useState("");
  const [add, setAdd] = useState(false);
  const load = useCallback(() => { setRows(null); api(`/api/governance/documents?${new URLSearchParams({ ...(cat ? { category: cat } : {}), ...(lv ? { level: lv } : {}) })}`).then((r) => setRows(r.rows)).catch((e) => { toast.err(e.message); setRows([]); }); }, [cat, lv, toast]);
  useEffect(() => { load(); }, [load]);
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select className="input !w-auto" value={cat} onChange={(e) => setCat(e.target.value)}><option value="">All types</option>{CATS.map((c) => <option key={c} value={c} className="capitalize">{c}</option>)}</select>
        <select className="input !w-auto" value={lv} onChange={(e) => setLv(e.target.value)}><option value="">All levels</option>{LEVELS.map((l) => <option key={l} value={l}>{LEVEL_LABEL[l]}</option>)}</select>
        <p className="flex items-center gap-1.5 text-xs text-white/50"><Lock className="h-3.5 w-3.5" />Only administrators of the level (and above) can open a document.</p>
        {canEdit && <button className="btn btn-primary ml-auto" onClick={() => setAdd(true)}><Plus className="h-4 w-4" />Upload document</button>}
      </div>
      {!rows && <div className="skeleton h-24" />}
      <div className="space-y-2">{rows?.map((d) => (
        <div key={d.id} className="glass flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <a href={`/api/media/${d.mediaId}`} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-3 hover:text-brand"><FileText className="h-5 w-5 shrink-0 text-brand" /><span className="min-w-0"><b className="block truncate">{d.title}</b><span className="block truncate text-xs text-white/50">{d.fileName} · {size(d.size)} · {d.place} · {d.uploadedByName} · {fmt(d.at)}</span></span></a>
          <div className="flex items-center gap-2"><span className="badge capitalize">{d.category}</span><LevelBadge level={d.level} />{d.canManage && <button className="btn btn-ghost btn-sm" aria-label="Delete" onClick={async () => { if (!confirm(`Delete "${d.title}"? This can't be undone.`)) return; try { await api(`/api/governance/documents/${d.id}`, { method: "DELETE" }); toast.ok("Deleted"); load(); } catch (e: any) { toast.err(e.message); } }}><Trash2 className="h-3.5 w-3.5" /></button>}</div>
        </div>))}
        {rows?.length === 0 && <div className="glass p-10 text-center text-white/50">No documents yet.</div>}</div>
      {add && <Upload me={me} onClose={() => setAdd(false)} onDone={() => { setAdd(false); load(); }} />}
    </>
  );
}

function Upload({ me, onClose, onDone }: { me: Me; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const file = useRef<HTMLInputElement>(null);
  const [parent, setParent] = useState("org");
  const [coms, setComs] = useState<any[]>([]);
  const [meets, setMeets] = useState<any[]>([]);
  const [org, setOrg] = useState<OrgVal>(defaultOrg(me));
  const [f, setF] = useState({ title: "", description: "", category: "other" });
  const [busy, setBusy] = useState(false);
  useEffect(() => { api("/api/governance/committees").then((r) => setComs(r.rows.filter((c: any) => c.canManage))).catch(() => {}); api("/api/governance/meetings").then((r) => setMeets(r.rows.filter((m: any) => m.canManage))).catch(() => {}); }, []);
  async function save() {
    const fl = file.current?.files?.[0];
    if (!fl) return toast.err("Choose a file first.");
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("file", fl); fd.set("title", f.title); fd.set("description", f.description); fd.set("category", f.category);
      if (parent.startsWith("c:")) fd.set("committee", parent.slice(2)); else if (parent.startsWith("m:")) fd.set("meeting", parent.slice(2));
      else { fd.set("level", org.level); if (org.zone) fd.set("zone", org.zone); if (org.area) fd.set("area", org.area); if (org.parish) fd.set("parish", org.parish); }
      const res = await fetch("/api/governance/documents", { method: "POST", body: fd });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Upload failed.");
      toast.ok("Uploaded"); onDone();
    } catch (e: any) { toast.err(e.message); }
    setBusy(false);
  }
  return (
    <Modal open onClose={onClose} title="Upload a document" wide>
      <div className="space-y-4">
        <Field label="Attach to"><select className="input" value={parent} onChange={(e) => setParent(e.target.value)}><option value="org">A level</option>{coms.length > 0 && <optgroup label="Committees">{coms.map((c) => <option key={c.id} value={`c:${c.id}`}>{c.name} · {c.place}</option>)}</optgroup>}{meets.length > 0 && <optgroup label="Meetings">{meets.map((m) => <option key={m.id} value={`m:${m.id}`}>{m.title} · {fmt(m.scheduledAt)}</option>)}</optgroup>}</select></Field>
        {parent === "org" && <OrgPicker me={me} value={org} onChange={setOrg} />}
        <div className="grid gap-3 sm:grid-cols-2"><Field label="Title"><input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Defaults to the file name" /></Field><Field label="Type"><select className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{CATS.map((c) => <option key={c} value={c}>{c}</option>)}</select></Field></div>
        <Field label="Note (optional)"><input className="input" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <Field label="File" hint="PDF, Word, Excel, PowerPoint, text, PNG or JPG. Up to 6 MB."><input ref={file} type="file" className="input" accept=".pdf,.doc,.docx,.xls,.xlsx,.pptx,.txt,.png,.jpg,.jpeg" /></Field>
        <button className="btn btn-primary w-full py-3" disabled={busy} onClick={save}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Upload</button>
      </div>
    </Modal>
  );
}
