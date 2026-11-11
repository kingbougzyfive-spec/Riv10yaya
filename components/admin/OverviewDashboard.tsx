"use client";
import { motion } from "framer-motion";
import { AlertTriangle, Bell, CheckCircle2, ChevronRight, Loader2, Phone } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { api } from "@/lib/fetcher";
import { formatNaira, MONTHS } from "@/lib/money";
import { FV_BADGE, FV_LABEL, REPORT_BADGE, REPORT_LABEL, type FvStatus, type ReportStatus } from "@/lib/verification";

const ORDER = ["province", "zone", "area", "parish"];
const Stat = ({ label, value, sub, tone, i = 0 }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "ok" | "warn" | "bad"; i?: number }) => (
  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className="glass relative overflow-hidden p-4">
    <span className={cn("absolute inset-y-0 left-0 w-1", tone === "bad" ? "bg-red-400" : tone === "warn" ? "bg-amber-400" : tone === "ok" ? "bg-emerald-400" : "bg-brand")} />
    <p className="text-[11px] font-semibold uppercase tracking-wide text-white/65">{label}</p><p className="mt-1 text-xl font-extrabold tabular-nums sm:text-2xl">{value}</p>{sub && <p className="mt-0.5 text-xs text-white/65">{sub}</p>}
  </motion.div>
);
const RBadge = ({ s }: { s: string }) => <span className={REPORT_BADGE[s as ReportStatus] ?? "badge"}>{REPORT_LABEL[s as ReportStatus] ?? s}</span>;
const FBadge = ({ s }: { s: string }) => <span className={FV_BADGE[s as FvStatus] ?? "badge"}>{FV_LABEL[s as FvStatus] ?? s}</span>;
const n = (v: number) => v.toLocaleString("en-NG");

export function OverviewDashboard() {
  const now = new Date();
  const [t, setT] = useState<{ zone?: string; area?: string; parish?: string }>({});
  const [p, setP] = useState({ month: now.getMonth() + 1, year: now.getFullYear() });
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState("");
  const load = useCallback(() => {
    setErr("");
    const qs = new URLSearchParams({ month: String(p.month), year: String(p.year), ...(t.parish ? { parish: t.parish } : t.area ? { area: t.area } : t.zone ? { zone: t.zone } : {}) });
    api(`/api/overview?${qs}`).then(setD).catch((e) => setErr(e.message));
  }, [t, p]);
  useEffect(() => { load(); }, [load]);
  const go = (kind: string, id: string) => { setD(null); setT(kind === "zone" ? { zone: id } : kind === "area" ? { area: id } : kind === "parish" ? { parish: id } : {}); };
  const y0 = now.getFullYear();

  if (err) return <div className="glass mb-6 p-5 text-sm text-red-300">{err}</div>;
  return (
    <section className="mb-8 space-y-5" aria-label="Organisation dashboard">
      <div className="flex flex-wrap items-center gap-2">
        <nav className="flex flex-wrap items-center gap-1 text-sm" aria-label="Where you are">
          {(d?.breadcrumb ?? []).map((c: any, i: number, a: any[]) => {
            const clickable = ORDER.indexOf(c.level) >= ORDER.indexOf(d.floor) && i < a.length - 1;
            return <span key={c.level} className="flex items-center gap-1">{i > 0 && <ChevronRight className="h-3.5 w-3.5 text-white/65" />}{clickable ? <button className="rounded-lg px-2 py-1 font-semibold text-brand hover:bg-white/5" onClick={() => go(c.level, c.id)}>{c.name}</button> : <span className={cn("px-2 py-1", i === a.length - 1 && "font-bold")}>{c.name}</span>}</span>;
          })}
        </nav>
        <div className="ml-auto flex gap-2">
          <select className="input !w-auto" aria-label="Month" value={p.month} onChange={(e) => setP({ ...p, month: Number(e.target.value) })}>{MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select>
          <select className="input !w-auto" aria-label="Year" value={p.year} onChange={(e) => setP({ ...p, year: Number(e.target.value) })}>{[y0 + 1, y0, y0 - 1, y0 - 2].map((y) => <option key={y}>{y}</option>)}</select>
        </div>
      </div>
      {!d ? <div className="grid place-items-center py-16"><Loader2 className="h-6 w-6 animate-spin text-brand" /></div> : (
        <>
          {d.level === "parish" && <ParishView d={d} />}
          {d.level === "area" && <AreaView d={d} />}
          {d.level === "zone" && <ZoneView d={d} />}
          {d.level === "province" && <ProvinceView d={d} />}
          {d.level !== "parish" && <Children d={d} onGo={go} />}
        </>
      )}
    </section>
  );
}

function Progress({ t }: { t: any }) {
  const total = t.remittancesSubmitted + t.remittancesMissing || 1;
  const seg: [number, string, string][] = [[t.fvConfirmed, "bg-emerald-400", "Confirmed"], [t.fvPartial, "bg-lime-400", "Part-paid"], [t.fvPending, "bg-amber-400", "Awaiting verification"], [t.fvProblem, "bg-red-400", "Problem"], [t.remittancesMissing, "bg-white/20", "Not submitted"]];
  return (
    <div className="glass p-4">
      <div className="mb-2 flex items-center justify-between"><p className="font-bold">Financial verification progress</p><span className="text-sm font-bold text-emerald-300">{t.fvPct}% confirmed</span></div>
      <div className="flex h-3 overflow-hidden rounded-full bg-white/10" role="img" aria-label={`${t.fvConfirmed} of ${t.remittancesSubmitted} submitted remittances confirmed`}>{seg.map(([v, c, l]) => v > 0 && <div key={l} className={c} style={{ width: `${(v / total) * 100}%` }} title={`${l}: ${v}`} />)}</div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/65">{seg.map(([v, c, l]) => <span key={l} className="flex items-center gap-1.5"><i className={cn("h-2 w-2 rounded-full", c)} />{l} {v}</span>)}</div>
    </div>
  );
}

function Attendance({ a }: { a: any }) {
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><Stat label="Check-ins" value={n(a.checkIns)} sub="This period" /><Stat label="Different people" value={n(a.unique)} /><Stat label="Members · visitors" value={`${n(a.members)} · ${n(a.visitors)}`} /><Stat label="Sessions" value={n(a.sessions)} sub={`${n(a.qr)} by QR`} /></div>;
}

function Money({ t, i = 0 }: { t: any; i?: number }) {
  return <><Stat i={i} label="Expected remittances" value={formatNaira(t.expectedKobo)} sub={`${t.remittancesSubmitted} of ${t.parishes} parishes submitted`} /><Stat i={i + 1} label="Confirmed" value={formatNaira(t.confirmedKobo)} tone="ok" sub="Verified by finance" /><Stat i={i + 2} label="Outstanding" value={formatNaira(t.outstandingKobo)} tone={t.outstandingKobo ? "warn" : "ok"} sub="Submitted returns only" /></>;
}

function ProvinceView({ d }: { d: any }) {
  const t = d.totals;
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Stat label="Zones" value={d.provincial.zones} /><Stat i={1} label="Areas" value={d.provincial.areas} /><Stat i={2} label="Parishes" value={d.provincial.parishes} /><Stat i={3} label="Reports submitted" value={`${t.reportsSubmitted}/${t.parishes}`} sub={`${t.reportsOutstanding} outstanding`} tone={t.reportsOutstanding ? "warn" : "ok"} /></div>
      <div className="grid gap-3 sm:grid-cols-3"><Money t={t} /></div>
      <Progress t={t} /><Attendance a={d.attendance} />
      <p className="text-xs text-white/65">Money is added up once, from each parish's own remittance. Area and zone figures below are sums of their parishes, never added again.</p>
    </>
  );
}
function ZoneView({ d }: { d: any }) {
  const t = d.totals, z = d.zone;
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Areas" value={z.areas} /><Stat i={1} label="Parishes" value={z.parishes} sub={`${z.direct} directly attached`} /><Stat i={2} label="Area reports" value={`${z.areaReportsSubmitted}/${z.areas}`} sub={`${z.areaReportsOutstanding} outstanding`} tone={z.areaReportsOutstanding ? "warn" : "ok"} />
        <Stat i={3} label="Parish reports" value={`${t.reportsSubmitted}/${t.parishes}`} sub={`${t.reportsOutstanding} outstanding`} tone={t.reportsOutstanding ? "warn" : "ok"} />
      </div>
      <div className="grid gap-3 sm:grid-cols-3"><Money t={t} /></div>
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="glass flex items-center justify-between p-4"><div><p className="text-[11px] font-semibold uppercase tracking-wide text-white/65">Zonal report</p><p className="mt-1"><RBadge s={z.zoneReport.status} /></p></div>{z.zoneReport.reportId && <span className="text-xs text-white/65">{z.zoneReport.reportId}</span>}{z.zoneReport.status === "not_started" && <Link href="/admin/reports/new" className="btn btn-primary btn-sm">Start</Link>}</div>
        <div className="glass p-4"><p className="font-bold">Zonal activities</p>{z.zoneActivity && <p className="mt-1 text-xs text-white/65">From the zonal report: {z.zoneActivity.meetings ?? 0} meetings{z.zoneActivity.programmes ? ` · ${String(z.zoneActivity.programmes).slice(0, 80)}` : ""}</p>}
          {z.activities.length ? <ul className="mt-2 space-y-1 text-sm">{z.activities.map((a: any) => <li key={a.id} className="flex justify-between gap-3"><span>{a.title}</span><span className="text-xs text-white/65">{new Date(a.date).toLocaleDateString("en-NG")}</span></li>)}</ul> : !z.zoneActivity && <p className="mt-1 text-sm text-white/65">No zonal activities recorded this month.</p>}</div>
      </div>
      <Progress t={t} /><Attendance a={d.attendance} />
    </>
  );
}
function AreaView({ d }: { d: any }) {
  const t = d.totals, a = d.area;
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Parishes" value={a.parishes} /><Stat i={1} label="Reports submitted" value={`${t.reportsSubmitted}/${t.parishes}`} tone={t.reportsOutstanding ? "warn" : "ok"} /><Stat i={2} label="Outstanding reports" value={t.reportsOutstanding} tone={t.reportsOutstanding ? "warn" : "ok"} />
        <div className="glass p-4"><p className="text-[11px] font-semibold uppercase tracking-wide text-white/65">Area report</p><p className="mt-2"><RBadge s={a.areaReport.status} /></p>{a.areaReport.reportId && <p className="mt-1 text-xs text-white/65">{a.areaReport.reportId}</p>}</div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3"><Money t={t} /></div>
      <Progress t={t} /><Attendance a={d.attendance} />
    </>
  );
}

function ParishView({ d }: { d: any }) {
  const p = d.parish, r = p.row;
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Expected remittance" value={r.hasRemittance ? formatNaira(r.requiredKobo) : "—"} sub={r.hasRemittance ? "From your submitted offering" : "Not submitted yet"} />
        <Stat i={1} label="Amount paid" value={formatNaira(r.hasRemittance ? r.declaredKobo : 0)} sub={`${formatNaira(r.confirmedKobo)} confirmed`} tone={r.confirmedKobo && !r.outstandingKobo ? "ok" : undefined} />
        <div className="glass p-4"><p className="text-[11px] font-semibold uppercase tracking-wide text-white/65">Financial verification</p><p className="mt-2"><FBadge s={r.fv} /></p>{r.outstandingKobo > 0 && <p className="mt-1 text-xs text-white/65">{formatNaira(r.outstandingKobo)} still to confirm</p>}</div>
        <div className="glass p-4"><p className="text-[11px] font-semibold uppercase tracking-wide text-white/65">Monthly report</p><p className="mt-2"><RBadge s={d.hasDraft && r.reportStatus === "not_started" ? "draft" : r.reportStatus} /></p>{r.reportId && <p className="mt-1 text-xs text-white/65">{r.reportId}</p>}</div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="glass p-4">
          <p className="mb-2 font-bold">Outstanding requirements</p>
          {p.requirements.length ? <ul className="space-y-2">{p.requirements.map((x: any, i: number) => <li key={i}><Link href={x.href} className="flex items-start gap-2 rounded-xl p-2 text-sm hover:bg-white/5"><AlertTriangle className={cn("mt-0.5 h-4 w-4 shrink-0", x.level === "bad" ? "text-red-400" : "text-accent")} />{x.text}</Link></li>)}</ul> : <p className="flex items-center gap-2 text-sm text-emerald-300"><CheckCircle2 className="h-4 w-4" />Nothing outstanding for this month.</p>}
        </div>
        <div className="glass p-4">
          <p className="mb-2 flex items-center gap-2 font-bold"><Bell className="h-4 w-4 text-brand" />Notifications</p>
          {p.notifications.length ? <ul className="space-y-2">{p.notifications.map((x: any) => <li key={x.id} className="text-sm"><Link href={x.link || "#"} className={cn("block rounded-xl p-2 hover:bg-white/5", !x.read && "bg-brand/10")}><span className="font-semibold">{x.title}</span><span className="block text-xs text-white/65">{x.body}</span></Link></li>)}</ul> : <p className="text-sm text-white/65">No notifications.</p>}
        </div>
      </div>
      <Attendance a={d.attendance} />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="glass p-4">
          <p className="mb-2 font-bold">Previous reports</p>
          {p.previous.length ? <ul className="divide-y divide-white/5">{p.previous.map((x: any) => <li key={x.id} className="flex items-center justify-between gap-3 py-2 text-sm"><span>{MONTHS[x.month - 1]} {x.year}<span className="ml-2 text-xs text-white/65">{x.reportId}</span></span><RBadge s={x.status} /></li>)}</ul> : <p className="text-sm text-white/65">No reports submitted yet.</p>}
          <Link href="/admin/reports" className="btn btn-ghost btn-sm mt-3">All reports</Link>
        </div>
        <div className="glass p-4">
          <p className="mb-2 flex items-center gap-2 font-bold"><Phone className="h-4 w-4 text-brand" />Contact information</p>
          {p.contacts ? <div className="space-y-3 text-sm">
            {p.contacts.admins.map((a: any) => <div key={a.email}><p className="font-semibold">{a.name}</p><p className="text-xs text-white/65">{a.phone ?? "No phone saved"} · {a.email}</p></div>)}
            {p.contacts.lastReport && <div className="border-t border-white/10 pt-2"><p className="text-xs text-white/65">On your latest report</p><p>{p.contacts.lastReport.fullName}</p><p className="text-xs text-white/65">{p.contacts.lastReport.phone}{p.contacts.lastReport.altPhone ? ` · ${p.contacts.lastReport.altPhone}` : ""}</p></div>}
            {!p.contacts.admins.length && !p.contacts.lastReport && <p className="text-white/65">No contact on file.</p>}
            {p.address && <p className="text-xs text-white/65">{p.address}</p>}
          </div> : <p className="text-sm text-white/65">Contact details are visible to authorised administrators only.</p>}
        </div>
      </div>
    </>
  );
}

function Children({ d, onGo }: { d: any; onGo: (k: string, id: string) => void }) {
  const rows: any[] = d.children;
  const title = d.level === "province" ? "Zones" : d.level === "zone" ? "Areas and directly attached parishes" : "Parishes";
  return (
    <div className="glass overflow-x-auto">
      <p className="p-4 pb-2 font-bold">{title} <span className="text-xs font-normal text-white/65">· click a row to open it</span></p>
      <table className="w-full min-w-[820px] text-sm">
        <thead><tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-wide text-white/65"><th className="p-3">Name</th><th className="text-center">Parishes</th><th className="text-center">Reports</th><th className="text-right">Expected</th><th className="text-right">Confirmed</th><th className="text-right">Outstanding</th><th>Verification</th><th className="text-right pr-3">Check-ins</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.kind + r.id} className="cursor-pointer border-b border-white/5 hover:bg-white/5" onClick={() => onGo(r.kind, r.id)}>
              <td className="p-3 font-semibold"><button className="text-left hover:text-brand" onClick={(e) => { e.stopPropagation(); onGo(r.kind, r.id); }}>{r.name}</button><span className="ml-2 text-[10px] uppercase text-white/65">{r.kind}{r.note ? ` · ${r.note}` : ""}</span>{r.kind === "area" && r.areaReport && <span className="ml-2"><RBadge s={r.areaReport} /></span>}</td>
              <td className="text-center tabular-nums">{r.kind === "parish" ? "—" : r.parishes}</td>
              <td className="text-center tabular-nums">{r.kind === "parish" ? <RBadge s={r.reportStatus} /> : `${r.reportsSubmitted}/${r.parishes}`}</td>
              <td className="text-right tabular-nums">{formatNaira(r.expectedKobo)}</td><td className="text-right tabular-nums text-emerald-300">{formatNaira(r.confirmedKobo)}</td><td className={cn("text-right tabular-nums", r.outstandingKobo && "text-amber-300")}>{formatNaira(r.outstandingKobo)}</td>
              <td>{r.kind === "parish" ? (r.remittancesSubmitted ? <FBadge s={r.fv} /> : <span className="badge badge-warn">Not submitted</span>) : <span className="text-xs">{r.fvConfirmed}/{r.remittancesSubmitted} confirmed{r.fvProblem ? ` · ${r.fvProblem} issue${r.fvProblem > 1 ? "s" : ""}` : ""}</span>}</td>
              <td className="pr-3 text-right tabular-nums">{r.checkIns}</td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={8} className="p-8 text-center text-white/65">Nothing here yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
