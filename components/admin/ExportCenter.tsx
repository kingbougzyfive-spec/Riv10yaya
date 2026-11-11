"use client";
import { motion } from "framer-motion";
import { Download, FileSpreadsheet, FileText, Loader2, ShieldCheck, Table2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { api } from "@/lib/fetcher";
import type { ExportDef } from "@/lib/export/catalog";
import { Field, useOrg, type Me } from "./gov/shared";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
type Def = Omit<ExportDef, "roles">;
const FMT = { pdf: { label: "PDF", icon: FileText }, xlsx: { label: "Excel", icon: FileSpreadsheet }, csv: { label: "CSV", icon: Table2 } } as const;
const MONTHLY = new Set(["parish_monthly", "area_monthly", "zone_monthly", "provincial"]);

const lagosNow = () => { const d = new Date(Date.now() + 3600_000); return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 }; };
const today = () => new Date(Date.now() + 3600_000).toISOString().slice(0, 10);

export function ExportCenter({ defs, me }: { defs: Def[]; me: Me }) {
  const org = useOrg();
  const [key, setKey] = useState<string>(defs[0]?.key ?? "");
  const def = defs.find((d) => d.key === key);
  const now = lagosNow(); const prev = now.m === 1 ? { y: now.y - 1, m: 12 } : { y: now.y, m: now.m - 1 };
  const [f, setF] = useState<Record<string, string>>({});
  const [ev, setEv] = useState<any[]>([]);
  const [pv, setPv] = useState<any>(null);
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);

  // sensible defaults whenever the report changes
  useEffect(() => { if (!def) return; setF({ year: String(MONTHLY.has(def.key) ? prev.y : now.y), month: MONTHLY.has(def.key) ? String(prev.m) : "0", from: new Date(Date.now() - 90 * 86400_000).toISOString().slice(0, 10), to: today() }); setPv(null); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [key]);
  useEffect(() => { if (def?.filters.includes("event") && !ev.length) api("/api/public/events").then((r) => setEv(r.rows ?? r.events ?? [])).catch(() => {}); }, [def, ev.length]);

  const zones = (org?.zones ?? []).filter((z: any) => !me.zone || z.id === me.zone);
  const areas = (org?.areas ?? []).filter((a: any) => (!me.zone || a.zone === me.zone) && (!me.area || a.id === me.area) && (!f.zone || a.zone === f.zone));
  const parishes = (org?.parishes ?? []).filter((p: any) => (!me.zone || p.zone === me.zone) && (!me.area || p.area === me.area) && (!me.parish || p.id === me.parish) && (!f.zone || p.zone === f.zone) && (!f.area || p.area === f.area));

  const qs = useMemo(() => { if (!def) return ""; const p = new URLSearchParams(); for (const k of def.filters) { const v = f[k]; if (v !== undefined && v !== "") p.set(k, v); } return p.toString(); }, [def, f]);
  const needsEvent = def?.filters.includes("event") && def.key === "event_registrations" && !f.event;

  useEffect(() => {
    if (!def || needsEvent || !Object.keys(f).length) return;
    setBusy(true); setErr("");
    const t = setTimeout(() => { api(`/api/exports/${def.key}?${qs}`).then((r) => { setPv(r); setBusy(false); }).catch((e) => { setErr(e.message); setPv(null); setBusy(false); }); }, 350);
    return () => clearTimeout(t);
  }, [def, qs, needsEvent, f]);

  if (!def) return <div className="glass p-10 text-center text-white/65">No reports are available for your role.</div>;
  const set = (k: string, v: string) => setF((x) => ({ ...x, [k]: v, ...(k === "zone" ? { area: "", parish: "" } : k === "area" ? { parish: "" } : {}) }));
  const groups = [...new Set(defs.map((d) => d.group))];
  const has = (k: string) => def.filters.includes(k as any);

  return (
    <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
      <div className="space-y-4">
        {groups.map((g) => (
          <div key={g}>
            <p className="mb-1.5 px-1 text-[11px] font-bold uppercase tracking-wide text-white/65">{g}</p>
            <div className="space-y-1.5">{defs.filter((d) => d.group === g).map((d) => <button key={d.key} onClick={() => setKey(d.key)} className={cn("relative w-full rounded-xl border px-3.5 py-2.5 text-left text-sm transition", key === d.key ? "border-brand bg-brand/15" : "border-white/10 hover:border-white/25")}>{key === d.key && <motion.span layoutId="exp-sel" className="absolute inset-y-2 left-0 w-1 rounded-full bg-brand" />}<span className="font-semibold">{d.label}</span></button>)}</div>
          </div>
        ))}
      </div>

      <div className="min-w-0 space-y-4">
        <div className="glass space-y-4 p-5">
          <div><p className="text-lg font-bold">{def.label}</p><p className="text-sm text-white/65">{def.help}</p></div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {has("year") && <Field label="Year"><input className="input" type="number" min={2020} max={2100} value={f.year ?? ""} onChange={(e) => set("year", e.target.value)} /></Field>}
            {has("month") && <Field label="Month"><select className="input" value={f.month ?? "0"} onChange={(e) => set("month", e.target.value)}>{def.key !== "provincial" && <option value="0">Whole year</option>}{MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select></Field>}
            {has("from") && <Field label="From"><input className="input" type="date" value={f.from ?? ""} onChange={(e) => set("from", e.target.value)} /></Field>}
            {has("to") && <Field label="To"><input className="input" type="date" value={f.to ?? ""} onChange={(e) => set("to", e.target.value)} /></Field>}
            {has("zone") && zones.length > 1 && <Field label="Zone"><select className="input" value={f.zone ?? ""} onChange={(e) => set("zone", e.target.value)}><option value="">All zones</option>{zones.map((z: any) => <option key={z.id} value={z.id}>{z.name}</option>)}</select></Field>}
            {has("area") && areas.length > 1 && <Field label="Area"><select className="input" value={f.area ?? ""} onChange={(e) => set("area", e.target.value)}><option value="">All areas</option>{areas.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>}
            {has("parish") && parishes.length > 1 && <Field label="Parish"><select className="input" value={f.parish ?? ""} onChange={(e) => set("parish", e.target.value)}><option value="">All parishes</option>{parishes.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>}
            {has("event") && <Field label={def.key === "event_registrations" ? "Event" : "Event (optional)"}><select className="input" value={f.event ?? ""} onChange={(e) => set("event", e.target.value)}><option value="">{def.key === "event_registrations" ? "Choose an event…" : "All events"}</option>{ev.map((e: any) => <option key={e.id} value={e.id}>{e.title}</option>)}</select></Field>}
            {has("kind") && def.key === "confirmed_payments" && <Field label="Payment type"><select className="input" value={f.kind ?? ""} onChange={(e) => set("kind", e.target.value)}><option value="">All types</option><option value="yst">Youth Sunday 40%</option><option value="levy">Levies</option><option value="contribution">Contributions</option></select></Field>}
            {has("kind") && def.key === "attendance" && <Field label="Session type"><input className="input" placeholder="e.g. youth_sunday" value={f.kind ?? ""} onChange={(e) => set("kind", e.target.value)} /></Field>}
            {has("status") && def.group === "Monthly reports" && <Field label="Report status"><select className="input" value={f.status ?? ""} onChange={(e) => set("status", e.target.value)}><option value="">Any submitted</option><option value="submitted">Submitted</option><option value="completed">Completed</option><option value="incomplete">Incomplete</option><option value="revision_requested">Revision requested</option></select></Field>}
            {has("status") && def.key === "members" && <Field label="Member status"><select className="input" value={f.status ?? ""} onChange={(e) => set("status", e.target.value)}><option value="">Any</option>{["active", "inactive", "visitor", "transferred"].map((s) => <option key={s}>{s}</option>)}</select></Field>}
            {has("status") && def.key === "leadership" && <Field label="Appointments"><select className="input" value={f.status ?? ""} onChange={(e) => set("status", e.target.value)}><option value="">Current only</option><option value="all">Including past</option></select></Field>}
            {has("level") && <Field label="Level"><select className="input" value={f.level ?? ""} onChange={(e) => set("level", e.target.value)}><option value="">All levels</option>{["province", "zone", "area", "parish"].map((l) => <option key={l}>{l}</option>)}</select></Field>}
            {has("leaders") && <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" checked={f.leaders === "1"} onChange={(e) => set("leaders", e.target.checked ? "1" : "")} />Leaders only</label>}
          </div>
        </div>

        <div className="glass space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-2 font-bold">Preview {busy && <Loader2 className="h-4 w-4 animate-spin text-brand" />}</p>
            <div className="flex flex-wrap gap-2">{def.formats.map((fm) => { const ok = !!pv && pv.formats.includes(fm) && !busy; const I = FMT[fm].icon; return ok ? <a key={fm} className="btn btn-primary btn-sm" href={`/api/exports/${def.key}?${qs}&format=${fm}`}><I className="h-4 w-4" />{FMT[fm].label}</a> : <span key={fm} className="btn btn-ghost btn-sm pointer-events-none opacity-40"><I className="h-4 w-4" />{FMT[fm].label}</span>; })}</div>
          </div>
          {needsEvent && <p className="text-sm text-white/65">Choose an event to see the preview.</p>}
          {err && <p className="rounded-xl bg-red-500/10 p-3 text-sm text-red-200">{err}</p>}
          {pv && !err && (
            <div className="space-y-4">
              <div className="grid gap-2 rounded-xl bg-white/5 p-3 text-sm sm:grid-cols-2">
                {[["Organisation", pv.org], ["Reporting period", pv.period], ["Prepared by", pv.preparedBy], ["Records covered", pv.scope], ...(pv.filters.length ? [["Filters", pv.filters.join("; ")]] : []), ...(pv.administrator ? [["Administrator", pv.administrator]] : [])].map(([k, v]) => <p key={k}><span className="text-xs uppercase tracking-wide text-white/65">{k}</span><br />{v}</p>)}
              </div>
              {pv.verification && <p className="flex items-start gap-2 rounded-xl bg-emerald-500/10 p-3 text-sm text-emerald-100"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /><span><b>Financial verification: </b>{pv.verification}</span></p>}
              {pv.blocks.map((b: any, i: number) => b.t === "kv" ? (
                <div key={i} className="grid gap-2 sm:grid-cols-3">{b.items.map((it: any) => <div key={it.k} className="rounded-xl bg-white/5 p-3"><p className="text-[11px] uppercase tracking-wide text-white/65">{it.k}</p><p className="font-bold">{it.v}</p></div>)}</div>
              ) : (
                <div key={i} className="overflow-x-auto">
                  <p className="mb-1.5 text-sm font-bold">{b.title} <span className="font-normal text-white/65">· {b.total.toLocaleString("en-NG")} {b.total === 1 ? "row" : "rows"}</span></p>
                  <table className="w-full min-w-[560px] text-xs"><thead><tr className="border-b border-white/10 text-left text-white/65">{b.cols.map((c: any) => <th key={c.h} className={cn("px-2 py-1.5 font-semibold", ["money", "int", "pct"].includes(c.kind) && "text-right")}>{c.h}</th>)}</tr></thead>
                    <tbody>{b.rows.map((r: any[], j: number) => <tr key={j} className="border-b border-white/5">{r.map((v, k) => <td key={k} className={cn("px-2 py-1.5", ["money", "int", "pct"].includes(b.cols[k].kind) && "text-right tabular-nums")}>{typeof v === "number" && b.cols[k].kind === "money" ? v.toLocaleString("en-NG", { minimumFractionDigits: 2 }) : String(v ?? "")}</td>)}</tr>)}{b.totals && <tr className="font-bold">{b.totals.map((v: any, k: number) => <td key={k} className="px-2 py-1.5 text-right first:text-left">{typeof v === "number" && b.cols[k].kind === "money" ? v.toLocaleString("en-NG", { minimumFractionDigits: 2 }) : String(v ?? "")}</td>)}</tr>}</tbody></table>
                  {b.total > b.rows.length && <p className="mt-1 text-xs text-white/65">Showing the first {b.rows.length}. The download has everything.</p>}
                </div>
              ))}
              {pv.notes.map((n: string) => <p key={n} className="text-xs text-white/65">{n}</p>)}
            </div>
          )}
        </div>
        <p className="flex items-center gap-2 text-xs text-white/65"><Download className="h-3.5 w-3.5" />Downloads are logged. Exports contain only records within your role's access; handle files containing personal details as confidential.</p>
      </div>
    </div>
  );
}
