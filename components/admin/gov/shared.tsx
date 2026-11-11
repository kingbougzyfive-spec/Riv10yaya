"use client";
import { Search } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/fetcher";
import { creatableLevels, LEVEL_LABEL, type GLevel } from "@/lib/governance";

export type Me = { role: string; zone?: string; area?: string; parish?: string };
export type OrgVal = { level: GLevel; zone: string; area: string; parish: string };
export const fmt = (v?: string | Date | null) => (v ? new Date(v).toLocaleDateString("en-NG", { dateStyle: "medium" }) : "—");
export const fmtDT = (v?: string | Date | null) => (v ? new Date(v).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" }) : "—");
export const today = () => new Date().toISOString().slice(0, 10);
export const LevelBadge = ({ level }: { level: GLevel }) => <span className="badge">{LEVEL_LABEL[level]}</span>;
export const Field = ({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) => <div><label className="label">{label}</label>{children}{hint && <p className="hint">{hint}</p>}</div>;

export function useOrg() { const [o, setO] = useState<any>(null); useEffect(() => { api("/api/public/org").then(setO).catch(() => {}); }, []); return o; }

/** The default organisation for this admin: their own place. */
export function defaultOrg(me: Me): OrgVal {
  const lv = creatableLevels(me.role);
  const level = (me.role === "parish_admin" ? "parish" : me.role === "area_admin" ? "area" : me.role === "zonal_admin" ? "zone" : lv[0] ?? "province") as GLevel;
  return { level, zone: me.zone ?? "", area: me.area ?? "", parish: me.parish ?? "" };
}

/** Level + place chooser limited to what this role may create. The server re-checks everything. */
export function OrgPicker({ me, value, onChange }: { me: Me; value: OrgVal; onChange: (v: OrgVal) => void }) {
  const org = useOrg();
  const levels = creatableLevels(me.role);
  const set = (p: Partial<OrgVal>) => onChange({ ...value, ...p });
  const zones = (org?.zones ?? []).filter((z: any) => !me.zone || z.id === me.zone);
  const areas = (org?.areas ?? []).filter((a: any) => a.zone === value.zone && (!me.area || a.id === me.area));
  const parishes = (org?.parishes ?? []).filter((p: any) => p.zone === value.zone && (!value.area || p.area === value.area) && (!me.parish || p.id === me.parish) && (!me.area || p.area === me.area));
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Level"><select className="input" value={value.level} onChange={(e) => set({ level: e.target.value as GLevel })}>{levels.map((l) => <option key={l} value={l}>{LEVEL_LABEL[l]}</option>)}</select></Field>
      {value.level !== "province" && <Field label="Zone"><select className="input" value={value.zone} onChange={(e) => set({ zone: e.target.value, area: "", parish: "" })}><option value="">Select…</option>{zones.map((z: any) => <option key={z.id} value={z.id}>{z.name}</option>)}</select></Field>}
      {(value.level === "area" || value.level === "parish") && <Field label={value.level === "parish" ? "Area (if any)" : "Area"}><select className="input" value={value.area} onChange={(e) => set({ area: e.target.value, parish: "" })}><option value="">{value.level === "parish" ? "Directly under the zone" : "Select…"}</option>{areas.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>}
      {value.level === "parish" && <Field label="Parish"><select className="input" value={value.parish} onChange={(e) => set({ parish: e.target.value })}><option value="">Select…</option>{parishes.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>}
    </div>
  );
}
export const orgPayload = (v: OrgVal) => ({ level: v.level, ...(v.zone ? { zone: v.zone } : {}), ...(v.area ? { area: v.area } : {}), ...(v.parish ? { parish: v.parish } : {}) });

/** Search members inside an organisation and pick one. */
export function MemberPicker({ org, value, onChange, label = "Member" }: { org: Partial<OrgVal> & { level: GLevel }; value: { id: string; name: string } | null; onChange: (v: { id: string; name: string } | null) => void; label?: string }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    if (q.trim().length < 2) { setRows([]); return; }
    const p = new URLSearchParams({ q });
    if (org.level === "zone" && org.zone) p.set("zone", org.zone);
    if (org.level === "area" && org.area) p.set("area", org.area);
    if (org.level === "parish" && org.parish) p.set("parish", org.parish);
    const t = setTimeout(() => api(`/api/members?${p}`).then((r) => setRows(r.rows.slice(0, 8))).catch(() => setRows([])), 250);
    return () => clearTimeout(t);
  }, [q, org.level, org.zone, org.area, org.parish]);
  if (value) return <Field label={label}><div className="flex items-center justify-between rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm"><b>{value.name}</b><button type="button" className="text-xs text-white/65 hover:text-white" onClick={() => onChange(null)}>Change</button></div></Field>;
  return (
    <Field label={label}>
      <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/65" /><input className="input !pl-9" placeholder="Search by name or member ID…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      {rows.length > 0 && <ul className="mt-1 max-h-48 overflow-y-auto rounded-xl border border-white/10 bg-black/30">{rows.map((m) => <li key={m.id}><button type="button" className="flex w-full justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-white/10" onClick={() => { onChange({ id: m.id, name: m.name }); setQ(""); setRows([]); }}><span>{m.name}</span><span className="text-xs text-white/65">{m.parish} · {m.memberId}</span></button></li>)}</ul>}
    </Field>
  );
}

export const TASK_BADGE: Record<string, string> = { open: "badge", in_progress: "badge badge-warn", done: "badge badge-ok", cancelled: "badge" };
export const TASK_LABEL: Record<string, string> = { open: "To do", in_progress: "In progress", done: "Done", cancelled: "Cancelled" };

export function Responsibilities({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [t, setT] = useState("");
  return (
    <div>
      <label className="label">Responsibilities</label>
      <ul className="mb-2 space-y-1">{value.map((r, i) => <li key={i} className="flex items-start justify-between gap-2 rounded-lg bg-white/5 px-3 py-1.5 text-sm"><span>{r}</span><button type="button" className="text-xs text-white/65 hover:text-red-300" onClick={() => onChange(value.filter((_, j) => j !== i))}>Remove</button></li>)}</ul>
      <div className="flex gap-2"><input className="input" placeholder="Add a responsibility and press Add" value={t} onChange={(e) => setT(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && t.trim().length > 1) { e.preventDefault(); onChange([...value, t.trim()]); setT(""); } }} /><button type="button" className="btn btn-ghost" disabled={t.trim().length < 2} onClick={() => { onChange([...value, t.trim()]); setT(""); }}>Add</button></div>
    </div>
  );
}
