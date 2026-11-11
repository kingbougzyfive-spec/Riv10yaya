"use client";
import { motion } from "framer-motion";
import { ArrowRightLeft, Building2, ChevronDown, Layers, Loader2, MapPin, Pencil, Plus, Power, Search, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { api } from "@/lib/fetcher";
import { cn } from "@/lib/cn";

type Zone = { id: string; name: string; hasAreas: boolean; active: boolean };
type Area = { id: string; name: string; zone: string; active: boolean };
type Parish = { id: string; name: string; zone: string; area: string | null; active: boolean; address?: string };
type Dlg =
  | { kind: "zone"; edit?: Zone }
  | { kind: "area"; zone?: string; edit?: Area }
  | { kind: "parish"; zone?: string; area?: string | null; edit?: Parish }
  | { kind: "transfer"; parish: Parish }
  | null;

export function OrgManager({ canManage }: { canManage: boolean }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [data, setData] = useState<{ zones: Zone[]; areas: Area[]; parishes: Parish[] } | null>(null);
  const [q, setQ] = useState("");
  const [dlg, setDlg] = useState<Dlg>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const load = useCallback(() => api("/api/org").then(setData).catch((e) => toast.err(e.message)), [toast]);
  useEffect(() => { load(); }, [load]);

  const tree = useMemo(() => {
    if (!data) return [];
    const s = q.trim().toLowerCase();
    return data.zones.map((z) => {
      const areas = data.areas.filter((a) => a.zone === z.id).map((a) => ({ ...a, parishes: data.parishes.filter((p) => p.area === a.id) }));
      const direct = data.parishes.filter((p) => p.zone === z.id && !p.area);
      const match = (n: string) => n.toLowerCase().includes(s);
      if (!s) return [{ ...z, areas, direct }];
      const fa = areas.map((a) => ({ ...a, parishes: match(a.name) || match(z.name) ? a.parishes : a.parishes.filter((p) => match(p.name)) })).filter((a) => match(a.name) || match(z.name) || a.parishes.length);
      const fd = match(z.name) ? direct : direct.filter((p) => match(p.name));
      return match(z.name) || fa.length || fd.length ? [{ ...z, areas: fa, direct: fd }] : [];
    }).flat();
  }, [data, q]);

  async function call(method: string, url: string, json?: unknown, ok?: string) {
    try { await api(url, { method, json }); if (ok) toast.ok(ok); await load(); return true; }
    catch (e: any) { toast.err(e.message); return false; }
  }
  const toggle = (type: string, id: string, active: boolean) => call("PATCH", "/api/org", { type, id, active: !active }, active ? "Deactivated" : "Activated");
  const remove = async (type: string, id: string, name: string) => { if (await confirm({ title: `Delete "${name}"?`, message: "This can't be undone.", confirmLabel: "Delete" })) await call("DELETE", `/api/org?type=${type}&id=${id}`, undefined, "Deleted"); };

  if (!data) return <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-24" />)}</div>;

  const Row = ({ icon: I, name, active, sub, children }: { icon: any; name: string; active: boolean; sub?: string; children?: React.ReactNode }) => (
    <div className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 hover:bg-white/5">
      <div className="flex min-w-0 items-center gap-2.5"><I className="h-4 w-4 shrink-0 text-white/65" /><div className="min-w-0"><p className={cn("truncate text-sm", !active && "text-white/65 line-through")}>{name}</p>{sub && <p className="text-[11px] text-white/65">{sub}</p>}</div></div>
      {canManage && <div className="flex shrink-0 gap-1">{children}</div>}
    </div>
  );
  const Btn = ({ onClick, icon: I, label, danger }: { onClick: () => void; icon: any; label: string; danger?: boolean }) => (
    <button onClick={onClick} aria-label={label} title={label} className={cn("btn btn-ghost btn-sm !p-1.5", danger && "hover:!bg-red-500/20")}><I className="h-3.5 w-3.5" /></button>
  );

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1"><Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/65" /><input className="input !pl-10" placeholder="Search zone, area or parish…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        {canManage && <button className="btn btn-primary" onClick={() => setDlg({ kind: "zone" })}><Plus className="h-4 w-4" />Add zone</button>}
      </div>
      {tree.length === 0 && <div className="glass p-10 text-center text-white/65">{data.zones.length ? "Nothing matches your search." : "No zones yet. Add your first zone to start building the structure."}</div>}
      <div className="space-y-4">
        {tree.map((z, i) => {
          const isOpen = open[z.id] ?? !!q;
          const count = z.areas.reduce((n, a) => n + a.parishes.length, 0) + z.direct.length;
          return (
            <motion.div key={z.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.04, 0.4) }} className="glass overflow-hidden p-0">
              <button className="flex w-full items-center justify-between gap-3 p-4 text-left" onClick={() => setOpen({ ...open, [z.id]: !isOpen })}>
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/20 text-brand"><Layers className="h-5 w-5" /></div>
                  <div className="min-w-0"><p className={cn("truncate font-bold", !z.active && "text-white/65")}>{z.name}</p><p className="text-xs text-white/65">{z.hasAreas ? `${z.areas.length} areas` : "Standalone zone"} · {count} parishes</p></div>
                </div>
                <div className="flex items-center gap-2"><span className={cn("badge", z.active ? "badge-ok" : "badge-bad")}>{z.active ? "Active" : "Inactive"}</span><ChevronDown className={cn("h-4 w-4 transition", isOpen && "rotate-180")} /></div>
              </button>
              {isOpen && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} className="space-y-1 border-t border-white/10 p-3">
                  {canManage && (
                    <div className="mb-2 flex flex-wrap gap-2">
                      <button className="btn btn-ghost btn-sm" onClick={() => setDlg({ kind: "zone", edit: z })}><Pencil className="h-3.5 w-3.5" />Edit zone</button>
                      {z.hasAreas ? <button className="btn btn-ghost btn-sm" onClick={() => setDlg({ kind: "area", zone: z.id })}><Plus className="h-3.5 w-3.5" />Add area</button>
                        : <button className="btn btn-ghost btn-sm" onClick={() => setDlg({ kind: "parish", zone: z.id, area: null })}><Plus className="h-3.5 w-3.5" />Add parish</button>}
                      <button className="btn btn-ghost btn-sm" onClick={() => toggle("zone", z.id, z.active)}><Power className="h-3.5 w-3.5" />{z.active ? "Deactivate" : "Activate"}</button>
                      <button className="btn btn-danger btn-sm" onClick={() => remove("zone", z.id, z.name)}><Trash2 className="h-3.5 w-3.5" />Delete</button>
                    </div>
                  )}
                  {z.areas.map((a) => (
                    <div key={a.id} className="rounded-xl border border-white/10 bg-white/[.03] p-1.5">
                      <Row icon={MapPin} name={a.name} active={a.active} sub={`${a.parishes.length} parishes`}>
                        <Btn icon={Plus} label="Add parish" onClick={() => setDlg({ kind: "parish", zone: z.id, area: a.id })} />
                        <Btn icon={Pencil} label="Rename" onClick={() => setDlg({ kind: "area", edit: a })} />
                        <Btn icon={Power} label="Toggle active" onClick={() => toggle("area", a.id, a.active)} />
                        <Btn icon={Trash2} danger label="Delete" onClick={() => remove("area", a.id, a.name)} />
                      </Row>
                      <div className="ml-6 border-l border-white/10 pl-2">
                        {a.parishes.map((p) => (
                          <Row key={p.id} icon={Building2} name={p.name} active={p.active}>
                            <Btn icon={ArrowRightLeft} label="Transfer" onClick={() => setDlg({ kind: "transfer", parish: p })} />
                            <Btn icon={Pencil} label="Edit" onClick={() => setDlg({ kind: "parish", edit: p })} />
                            <Btn icon={Power} label="Toggle active" onClick={() => toggle("parish", p.id, p.active)} />
                            <Btn icon={Trash2} danger label="Delete" onClick={() => remove("parish", p.id, p.name)} />
                          </Row>
                        ))}
                      </div>
                    </div>
                  ))}
                  {z.direct.map((p) => (
                    <Row key={p.id} icon={Building2} name={p.name} active={p.active} sub="Directly under zone">
                      <Btn icon={ArrowRightLeft} label="Transfer" onClick={() => setDlg({ kind: "transfer", parish: p })} />
                      <Btn icon={Pencil} label="Edit" onClick={() => setDlg({ kind: "parish", edit: p })} />
                      <Btn icon={Power} label="Toggle active" onClick={() => toggle("parish", p.id, p.active)} />
                      <Btn icon={Trash2} danger label="Delete" onClick={() => remove("parish", p.id, p.name)} />
                    </Row>
                  ))}
                  {z.areas.length === 0 && z.direct.length === 0 && <p className="px-3 py-4 text-sm text-white/65">{z.hasAreas ? "No areas yet." : "No parishes yet."}</p>}
                </motion.div>
              )}
            </motion.div>
          );
        })}
      </div>
      <OrgDialog dlg={dlg} data={data} onClose={() => setDlg(null)} onDone={load} />
    </>
  );
}

function OrgDialog({ dlg, data, onClose, onDone }: { dlg: Dlg; data: { zones: Zone[]; areas: Area[]; parishes: Parish[] }; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [f, setF] = useState<any>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!dlg) return;
    if (dlg.kind === "zone") setF({ name: dlg.edit?.name ?? "", hasAreas: dlg.edit?.hasAreas ?? true });
    if (dlg.kind === "area") setF({ name: dlg.edit?.name ?? "", zone: dlg.zone ?? dlg.edit?.zone ?? "" });
    if (dlg.kind === "parish") setF({ name: dlg.edit?.name ?? "", zone: dlg.zone ?? dlg.edit?.zone ?? "", area: dlg.area ?? dlg.edit?.area ?? "", address: dlg.edit?.address ?? "" });
    if (dlg.kind === "transfer") setF({ zone: dlg.parish.zone, area: dlg.parish.area ?? "", reason: "" });
  }, [dlg]);
  if (!dlg) return <Modal open={false} onClose={onClose} title=""><></></Modal>;

  const zoneOf = data.zones.find((z) => z.id === f.zone);
  const areaOpts = data.areas.filter((a) => a.zone === f.zone);
  const isEdit = dlg.kind !== "transfer" && !!(dlg as any).edit;
  const title = dlg.kind === "transfer" ? `Transfer ${dlg.parish.name}` : `${isEdit ? "Edit" : "Add"} ${dlg.kind}`;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (dlg!.kind === "transfer") {
        await api("/api/org", { method: "PATCH", json: { type: "parish", id: dlg!.kind === "transfer" && dlg!.parish.id, zone: f.zone, area: f.area || null, reason: f.reason } });
        toast.ok("Parish transferred and logged");
      } else if (isEdit) {
        const e2 = (dlg as any).edit;
        const body: any = { type: dlg!.kind, id: e2.id, name: f.name };
        if (dlg!.kind === "zone") body.hasAreas = f.hasAreas;
        if (dlg!.kind === "parish") body.address = f.address;
        await api("/api/org", { method: "PATCH", json: body });
        toast.ok("Saved");
      } else {
        const body: any = { type: dlg!.kind, name: f.name };
        if (dlg!.kind === "zone") body.hasAreas = f.hasAreas;
        if (dlg!.kind === "area") body.zone = f.zone;
        if (dlg!.kind === "parish") { body.zone = f.zone; body.area = f.area || null; body.address = f.address; }
        await api("/api/org", { method: "POST", json: body });
        toast.ok("Added");
      }
      onClose(); onDone();
    } catch (e: any) { toast.err(e.message); }
    setBusy(false);
  }

  const placement = (
    <>
      <div><label className="label">Zone</label>
        <select className="input" required value={f.zone ?? ""} onChange={(e) => setF({ ...f, zone: e.target.value, area: "" })}>
          <option value="">Select zone…</option>{data.zones.map((z) => <option key={z.id} value={z.id}>{z.name}{z.hasAreas ? "" : " (standalone)"}</option>)}
        </select></div>
      {zoneOf?.hasAreas && (
        <div><label className="label">Area</label>
          <select className="input" required value={f.area ?? ""} onChange={(e) => setF({ ...f, area: e.target.value })}><option value="">Select area…</option>{areaOpts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
      )}
      {zoneOf && !zoneOf.hasAreas && <p className="badge-ok rounded-xl p-3 text-xs">This is a standalone zone: the parish will sit directly under it.</p>}
    </>
  );

  return (
    <Modal open onClose={onClose} title={title}>
      <form onSubmit={submit} className="space-y-4">
        {dlg.kind !== "transfer" && <div><label className="label">Name</label><input className="input" required autoFocus value={f.name ?? ""} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>}
        {dlg.kind === "zone" && (
          <button type="button" onClick={() => setF({ ...f, hasAreas: !f.hasAreas })} className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left">
            <span><span className="block text-sm font-medium">{f.hasAreas ? "This zone has areas" : "Standalone zone"}</span><span className="block text-xs text-white/65">{f.hasAreas ? "Parishes sit under areas." : "Parishes sit directly under the zone."}</span></span>
            <span className={cn("relative h-6 w-11 rounded-full transition", f.hasAreas ? "bg-brand" : "bg-white/20")}><span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all", f.hasAreas ? "left-[22px]" : "left-0.5")} /></span>
          </button>
        )}
        {dlg.kind === "area" && !isEdit && (
          <div><label className="label">Zone</label><select className="input" required value={f.zone ?? ""} onChange={(e) => setF({ ...f, zone: e.target.value })}><option value="">Select zone…</option>{data.zones.filter((z) => z.hasAreas).map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}</select></div>
        )}
        {dlg.kind === "parish" && !isEdit && placement}
        {dlg.kind === "parish" && <div><label className="label">Address (optional)</label><input className="input" value={f.address ?? ""} onChange={(e) => setF({ ...f, address: e.target.value })} /></div>}
        {dlg.kind === "transfer" && (<>{placement}<div><label className="label">Reason for transfer</label><textarea className="input" required rows={3} value={f.reason ?? ""} onChange={(e) => setF({ ...f, reason: e.target.value })} /><p className="hint">Recorded in the parish history and audit log.</p></div></>)}
        <button className="btn btn-primary w-full py-3" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}{dlg.kind === "transfer" ? "Transfer parish" : "Save"}</button>
      </form>
    </Modal>
  );
}
