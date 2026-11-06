"use client";
import { motion } from "framer-motion";
import { Download, Loader2, Scale } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { api } from "@/lib/fetcher";
import { formatNaira, MONTHS } from "@/lib/money";
import { FV_LABEL, type FvStatus } from "@/lib/verification";

type Rec = { id: string; parish: string; zone: string; area: string; kind: string; label: string; period: string; amountKobo: number; confirmedKobo: number; status: string; reference: string; at: string; note: string };
const C = { brand: "rgb(var(--brand))", accent: "rgb(var(--accent))", warn: "#f59e0b", bad: "#ef4444", mute: "rgb(var(--fg) / .45)" };
const short = (k: number) => { const n = k / 100; return n >= 1e6 ? `₦${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `₦${(n / 1e3).toFixed(0)}k` : `₦${n}`; };
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

export function FinanceDashboard() {
  const toast = useToast();
  const now = new Date();
  const [f, setF] = useState({ year: now.getFullYear(), month: now.getMonth() + 1, zone: "", area: "", parish: "" });
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState<"overview" | "breakdown" | "reconciliation">("overview");
  const [open, setOpen] = useState<{ metric: string; title: string } | null>(null);

  const qs = useMemo(() => new URLSearchParams(Object.entries({ year: String(f.year), month: String(f.month), zone: f.zone, area: f.area, parish: f.parish }).filter(([, v]) => v !== "")).toString(), [f]);
  const load = useCallback(() => { setD(null); setErr(""); api(`/api/finance/dashboard?${qs}`).then(setD).catch((e) => { setErr(e.message); toast.err(e.message); }); }, [qs, toast]);
  useEffect(() => { load(); }, [load]);

  const areas = (d?.areas ?? []).filter((a: any) => !f.zone || a.zone === f.zone);
  const parishes = (d?.parishes ?? []).filter((p: any) => (!f.zone || p.zone === f.zone) && (!f.area || p.area === f.area));
  const y0 = now.getFullYear();
  const periodLabel = f.month ? `${MONTHS[f.month - 1]} ${f.year}` : `All of ${f.year}`;

  return (
    <div className="space-y-6">
      <div className="glass flex flex-wrap items-center gap-3 p-4">
        <select className="input !w-auto" aria-label="Month" value={f.month} onChange={(e) => setF({ ...f, month: Number(e.target.value) })}><option value={0}>Whole year</option>{MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select>
        <select className="input !w-auto" aria-label="Year" value={f.year} onChange={(e) => setF({ ...f, year: Number(e.target.value) })}>{[y0 + 1, y0, y0 - 1, y0 - 2, y0 - 3].map((y) => <option key={y}>{y}</option>)}</select>
        <select className="input !w-auto" aria-label="Zone" value={f.zone} onChange={(e) => setF({ ...f, zone: e.target.value, area: "", parish: "" })}><option value="">All zones</option>{(d?.zones ?? []).map((z: any) => <option key={z.id} value={z.id}>{z.name}</option>)}</select>
        <select className="input !w-auto" aria-label="Area" value={f.area} onChange={(e) => setF({ ...f, area: e.target.value, parish: "" })}><option value="">All areas</option>{areas.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
        <select className="input !w-auto" aria-label="Parish" value={f.parish} onChange={(e) => setF({ ...f, parish: e.target.value })}><option value="">All parishes</option>{parishes.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <div className="glass ml-auto flex gap-1 p-1">{([["overview", "Overview"], ["breakdown", "Zones · Areas · Parishes"], ["reconciliation", "Reconciliation"]] as const).map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={cn("relative rounded-xl px-3.5 py-2 text-sm font-semibold", tab === k ? "text-[#04130d]" : "text-white/60")}>{tab === k && <motion.span layoutId="fd-tab" className="absolute inset-0 rounded-xl bg-brand" />}<span className="relative">{l}</span></button>)}</div>
      </div>

      {err && <div className="glass p-6 text-sm text-red-300">{err}</div>}
      {!d && !err && <div className="grid place-items-center py-24"><Loader2 className="h-6 w-6 animate-spin text-brand" /></div>}

      {d && tab === "overview" && <Overview d={d} periodLabel={periodLabel} onOpen={(metric, title) => setOpen({ metric, title })} />}
      {d && tab === "breakdown" && <Breakdown d={d} onPick={(patch) => { setF({ ...f, ...patch }); setTab("overview"); }} />}
      {d && tab === "reconciliation" && <Reconciliation d={d} qs={qs} onOpen={(metric, title) => setOpen({ metric, title })} />}

      <Drill open={open} qs={qs} periodLabel={periodLabel} onClose={() => setOpen(null)} />
    </div>
  );
}

function Card({ label, value, sub, tone, onClick, i }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "ok" | "warn" | "bad" | "accent"; onClick: () => void; i: number }) {
  const bar = tone === "ok" ? "bg-emerald-400" : tone === "warn" ? "bg-amber-400" : tone === "bad" ? "bg-red-400" : tone === "accent" ? "bg-accent" : "bg-brand";
  return (
    <motion.button initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} whileHover={{ y: -3 }} onClick={onClick} className="glass relative overflow-hidden p-4 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand" title="Show the records behind this figure">
      <span className={cn("absolute inset-y-0 left-0 w-1", bar)} />
      <p className="text-[11px] font-semibold uppercase tracking-wide text-white/50">{label}</p>
      <p className="mt-1 text-xl font-extrabold tabular-nums sm:text-2xl">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-white/50">{sub}</p>}
    </motion.button>
  );
}

function Overview({ d, periodLabel, onOpen }: { d: any; periodLabel: string; onOpen: (m: string, t: string) => void }) {
  const c = d.cards;
  const cards: [string, string, ReactNode, ReactNode, any?][] = [
    ["expected", "Expected remittances", formatNaira(c.expected), "From submitted returns"],
    ["confirmed", "Confirmed", formatNaira(c.confirmed), `${pct(c.confirmed, c.expected)}% of expected`, "ok"],
    ["outstanding", "Outstanding", formatNaira(c.outstanding), "Expected minus confirmed", c.outstanding ? "warn" : "ok"],
    ["pending", "Pending verification", formatNaira(c.pending), "Awaiting finance", "accent"],
    ["flagged", "Flagged payments", formatNaira(c.flagged), "Not found · mismatch · resubmit", c.flagged ? "bad" : undefined],
    ["rejected", "Rejected payments", formatNaira(c.rejected), "Declared, not accepted", c.rejected ? "bad" : undefined],
    ["levies", "Additional levies", formatNaira(c.levies), `${formatNaira(c.leviesConfirmed)} confirmed`],
    ["contributions", "Contributions", formatNaira(c.contributions), `${formatNaira(c.contributionsConfirmed)} confirmed`],
    ["partial", "Partial payments", c.partialCount, `${formatNaira(c.partialConfirmed)} confirmed so far`, c.partialCount ? "warn" : undefined],
    ["overpaid", "Overpayments", c.overCount, `${formatNaira(c.overpaid)} above required`, c.overCount ? "accent" : undefined],
    ["parishes_expected", "Parishes expected", c.parishes, "Active in the period"],
    ["parishes_submitted", "Parishes submitted", c.submitted, `${pct(c.submitted, c.parishes)}% of expected`, "ok"],
    ["parishes_missing", "Yet to submit", c.parishes - c.submitted, "No Youth Sunday return", c.parishes - c.submitted ? "warn" : "ok"],
  ];
  const data = d.trend.map((t: any) => ({ ...t, name: MONTHS[t.month - 1].slice(0, 3), expectedN: t.expected / 100, confirmedN: t.confirmed / 100, outstandingN: t.outstanding / 100 }));
  const zdata = d.byZone.map((z: any) => ({ name: z.name, Expected: z.expected / 100, Confirmed: z.confirmed / 100 }));
  const empty = c.expected === 0 && c.parishes === 0;
  return (
    <>
      <p className="text-sm text-white/55">Showing <b className="text-white/80">{periodLabel}</b>. Click any figure to see the records behind it.</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{cards.map(([m, l, v, s, tone], i) => <Card key={m} i={i} label={l} value={v} sub={s} tone={tone} onClick={() => onOpen(m, l)} />)}</div>
      {empty && <div className="glass p-8 text-center text-sm text-white/60">No parishes or returns match these filters yet.</div>}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Monthly collection trend" note="Expected vs confirmed, by month">
          <ResponsiveContainer width="100%" height={260}><LineChart data={data}><CartesianGrid stroke="rgb(var(--fg) / .08)" vertical={false} /><XAxis dataKey="name" stroke={C.mute} fontSize={11} /><YAxis stroke={C.mute} fontSize={11} tickFormatter={(v) => short(v * 100)} width={54} /><Tooltip formatter={(v: number) => formatNaira(Math.round(v * 100))} contentStyle={{ background: "rgb(var(--bg))", border: "1px solid rgb(var(--fg) / .15)", borderRadius: 12 }} /><Legend /><Line type="monotone" dataKey="expectedN" name="Expected" stroke={C.accent} strokeWidth={2} dot={false} /><Line type="monotone" dataKey="confirmedN" name="Confirmed" stroke={C.brand} strokeWidth={3} dot={{ r: 3 }} /><Line type="monotone" dataKey="outstandingN" name="Outstanding" stroke={C.bad} strokeWidth={2} strokeDasharray="4 4" dot={false} /></LineChart></ResponsiveContainer>
        </Panel>
        <Panel title="Zone comparison" note="Expected vs confirmed in the period">
          {zdata.length ? <ResponsiveContainer width="100%" height={260}><BarChart data={zdata}><CartesianGrid stroke="rgb(var(--fg) / .08)" vertical={false} /><XAxis dataKey="name" stroke={C.mute} fontSize={11} interval={0} /><YAxis stroke={C.mute} fontSize={11} tickFormatter={(v) => short(v * 100)} width={54} /><Tooltip formatter={(v: number) => formatNaira(Math.round(v * 100))} contentStyle={{ background: "rgb(var(--bg))", border: "1px solid rgb(var(--fg) / .15)", borderRadius: 12 }} /><Legend /><Bar dataKey="Expected" fill={C.accent} radius={[6, 6, 0, 0]} /><Bar dataKey="Confirmed" fill={C.brand} radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer> : <Empty />}
        </Panel>
        <Panel title="Parish submissions by month" note="Parishes that submitted vs expected">
          <ResponsiveContainer width="100%" height={240}><BarChart data={data}><CartesianGrid stroke="rgb(var(--fg) / .08)" vertical={false} /><XAxis dataKey="name" stroke={C.mute} fontSize={11} /><YAxis stroke={C.mute} fontSize={11} allowDecimals={false} width={30} /><Tooltip contentStyle={{ background: "rgb(var(--bg))", border: "1px solid rgb(var(--fg) / .15)", borderRadius: 12 }} /><Legend /><Bar dataKey="parishes" name="Expected" fill={C.mute} radius={[6, 6, 0, 0]} /><Bar dataKey="submitted" name="Submitted" fill={C.brand} radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer>
        </Panel>
        <Panel title="Levies & contributions by month" note="Declared amounts, shown apart from the 40%">
          <ResponsiveContainer width="100%" height={240}><BarChart data={data.map((t: any) => ({ ...t, levyN: t.levies / 100 }))}><CartesianGrid stroke="rgb(var(--fg) / .08)" vertical={false} /><XAxis dataKey="name" stroke={C.mute} fontSize={11} /><YAxis stroke={C.mute} fontSize={11} tickFormatter={(v) => short(v * 100)} width={54} /><Tooltip formatter={(v: number) => formatNaira(Math.round(v * 100))} contentStyle={{ background: "rgb(var(--bg))", border: "1px solid rgb(var(--fg) / .15)", borderRadius: 12 }} /><Bar dataKey="levyN" name="Levies & contributions" fill={C.accent} radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer>
        </Panel>
      </div>
    </>
  );
}

const Panel = ({ title, note, children }: { title: string; note?: string; children: ReactNode }) => <div className="glass p-4"><p className="font-bold">{title}</p>{note && <p className="mb-3 text-xs text-white/50">{note}</p>}{children}</div>;
const Empty = () => <p className="py-16 text-center text-sm text-white/50">Nothing to chart yet.</p>;

function Breakdown({ d, onPick }: { d: any; onPick: (p: any) => void }) {
  const [level, setLevel] = useState<"zone" | "area" | "parish">("zone");
  const rows = level === "zone" ? d.byZone : level === "area" ? d.byArea : d.byParish;
  const tot = d.cards;
  return (
    <div className="space-y-4">
      <div className="glass inline-flex gap-1 p-1">{(["zone", "area", "parish"] as const).map((k) => <button key={k} onClick={() => setLevel(k)} className={cn("relative rounded-xl px-4 py-2 text-sm font-semibold capitalize", level === k ? "text-[#04130d]" : "text-white/60")}>{level === k && <motion.span layoutId="fd-lvl" className="absolute inset-0 rounded-xl bg-brand" />}<span className="relative">By {k}</span></button>)}</div>
      <div className="glass overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead><tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-wide text-white/50"><th className="p-3">{level}</th>{level === "parish" && <th>Zone / Area</th>}<th className="text-right">Expected</th><th className="text-right">Confirmed</th><th className="text-right">Outstanding</th><th className="text-right">Pending</th><th className="text-right">Flagged</th><th className="text-right">Levies + contrib.</th><th className="text-center">Submitted</th></tr></thead>
          <tbody>
            {rows.map((r: any) => (
              <tr key={r.id} className="border-b border-white/5 hover:bg-white/5">
                <td className="p-3 font-semibold">{level === "zone" ? <button className="hover:text-brand" onClick={() => onPick({ zone: r.id })}>{r.name}</button> : level === "area" ? <button className="hover:text-brand" onClick={() => onPick({ area: r.id })}>{r.name}</button> : <button className="hover:text-brand" onClick={() => onPick({ parish: r.id })}>{r.name}</button>}</td>
                {level === "parish" && <td className="text-xs text-white/55">{r.zone}{r.area ? ` · ${r.area}` : ""}</td>}
                <td className="text-right tabular-nums">{formatNaira(r.expected)}</td><td className="text-right font-semibold tabular-nums text-emerald-300">{formatNaira(r.confirmed)}</td>
                <td className={cn("text-right tabular-nums", r.outstanding && "text-amber-300")}>{formatNaira(r.outstanding)}</td><td className="text-right tabular-nums">{formatNaira(r.pending)}</td><td className={cn("text-right tabular-nums", r.flagged && "text-red-300")}>{formatNaira(r.flagged)}</td>
                <td className="text-right tabular-nums">{formatNaira(r.levies + r.contributions)}</td>
                <td className="text-center">{level === "parish" ? (r.hasSubmitted ? <span className="badge badge-ok">Submitted</span> : <span className="badge badge-warn">Not submitted</span>) : <span className="text-xs">{r.submitted}/{r.parishes}</span>}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={9} className="p-8 text-center text-white/50">No records for these filters.</td></tr>}
          </tbody>
          {!!rows.length && <tfoot><tr className="border-t border-white/15 font-bold"><td className="p-3">Total (this view)</td>{level === "parish" && <td />}<td className="text-right tabular-nums">{formatNaira(tot.expected)}</td><td className="text-right tabular-nums">{formatNaira(tot.confirmed)}</td><td className="text-right tabular-nums">{formatNaira(tot.outstanding)}</td><td className="text-right tabular-nums">{formatNaira(tot.pending)}</td><td className="text-right tabular-nums">{formatNaira(tot.flagged)}</td><td className="text-right tabular-nums">{formatNaira(tot.levies + tot.contributions)}</td><td className="text-center text-xs">{tot.submitted}/{tot.parishes}</td></tr></tfoot>}
        </table>
      </div>
      {level === "area" && <p className="text-xs text-white/50">Parishes in standalone zones have no area, so they appear only under their zone. Each parish is counted once, in the zone, area and parish views alike.</p>}
    </div>
  );
}

function Reconciliation({ d, qs, onOpen }: { d: any; qs: string; onOpen: (m: string, t: string) => void }) {
  const r = d.reconciliation;
  const Row = ({ l, v, note, strong, onClick }: { l: string; v: number; note?: string; strong?: boolean; onClick?: () => void }) => (
    <div className={cn("flex items-baseline justify-between gap-4 border-b border-white/5 py-2", strong && "font-bold")}>
      <div>{onClick ? <button onClick={onClick} className="text-left hover:text-brand">{l}</button> : l}{note && <p className="text-xs font-normal text-white/45">{note}</p>}</div><span className="tabular-nums">{formatNaira(v)}</span>
    </div>
  );
  const Ok = ({ ok }: { ok: boolean }) => <span className={cn("badge", ok ? "badge-ok" : "badge-bad")}>{ok ? "Reconciles" : "Does not reconcile"}</span>;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="glass p-5">
          <div className="mb-2 flex items-center justify-between"><p className="flex items-center gap-2 font-bold"><Scale className="h-4 w-4 text-brand" />Declared money, accounted for</p><Ok ok={r.partitionOk} /></div>
          <Row l="Total declared by parishes" v={r.declaredTotal} note="Every payment, original and additional, Youth Sunday and levies" strong onClick={() => onOpen("ledger", "All payments")} />
          <Row l="Confirmed" v={r.confirmed} onClick={() => onOpen("confirmed", "Confirmed payments")} />
          <Row l="Pending verification" v={r.pending} onClick={() => onOpen("pending", "Pending verification")} />
          <Row l="Flagged" v={r.flagged} onClick={() => onOpen("flagged", "Flagged payments")} />
          <Row l="Rejected" v={r.rejected} onClick={() => onOpen("rejected", "Rejected payments")} />
          <Row l="Sum of the four above" v={r.partitionSum} strong />
        </div>
        <div className="glass p-5">
          <div className="mb-2 flex items-center justify-between"><p className="font-bold">Required vs confirmed (Youth Sunday 40%)</p><Ok ok={r.yst.ok} /></div>
          <Row l="Required" v={r.yst.required} onClick={() => onOpen("expected", "Expected remittances")} />
          <Row l="Confirmed" v={r.yst.confirmed} />
          <Row l="Outstanding" v={r.yst.outstanding} onClick={() => onOpen("outstanding", "Outstanding")} />
          <Row l="Overpaid" v={r.yst.overpaid} onClick={() => onOpen("overpaid", "Overpayments")} />
          <p className="pt-2 text-xs text-white/50">Required − confirmed = outstanding − overpaid, for every parish.</p>
          <div className="mt-4 border-t border-white/10 pt-3">
            <p className="mb-1 text-sm font-semibold">Bank-confirmed amounts</p>
            <Row l="Confirmed from the bank" v={r.confirmedReceived} note="What finance saw, on confirmed payments (Youth Sunday and levies)" />
            <Row l="Difference from the declared amount" v={r.confirmedDifference} note="Confirmed minus declared on those payments" />
            <Row l="Manual adjustments" v={r.adjustments} note="Signed, each with a recorded reason" />
          </div>
        </div>
      </div>
      <div className="glass flex flex-wrap items-center gap-3 p-4">
        <p className="text-sm text-white/70">Detailed screens:</p>
        <button className="btn btn-ghost btn-sm" onClick={() => onOpen("variance", "Variance: declared or confirmed differs from required")}>Variances</button>
        <button className="btn btn-ghost btn-sm" onClick={() => onOpen("ledger", "Payment ledger")}>Payment ledger</button>
        <span className="ml-auto text-xs text-white/50">{r.declaredTotal ? "" : "No payments in this selection."} {d.counts.payments} payments · {d.counts.remittances} obligations</span>
      </div>
    </div>
  );
}

function Drill({ open, qs, onClose, periodLabel }: { open: { metric: string; title: string } | null; qs: string; onClose: () => void; periodLabel: string }) {
  const [rows, setRows] = useState<Rec[] | null>(null);
  const [err, setErr] = useState("");
  const [find, setFind] = useState("");
  useEffect(() => {
    if (!open) return;
    setRows(null); setErr(""); setFind("");
    api(`/api/finance/dashboard/records?metric=${open.metric}&${qs}`).then((r) => setRows(r.rows)).catch((e) => setErr(e.message));
  }, [open, qs]);
  const shown = (rows ?? []).filter((r) => !find || `${r.parish} ${r.zone} ${r.area} ${r.reference}`.toLowerCase().includes(find.toLowerCase()));
  const money = open ? !open.metric.startsWith("parishes") : true;
  const total = shown.reduce((n, r) => n + r.amountKobo, 0);
  const statusText = (s: string) => (s === "not_submitted" ? "Not submitted" : s === "submitted" && !money ? "Submitted" : (FV_LABEL as Record<string, string>)[s] ?? s);
  return (
    <Modal open={!!open} onClose={onClose} title={open ? `${open.title} · ${periodLabel}` : ""} wide>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input className="input !w-auto flex-1" placeholder="Search parish, zone, reference" value={find} onChange={(e) => setFind(e.target.value)} />
        {(["csv", "xlsx", "pdf"] as const).map((f) => <a key={f} className="btn btn-ghost btn-sm" href={`/api/finance/dashboard/records?metric=${open?.metric}&${qs}&format=${f}`}><Download className="h-3.5 w-3.5" />{f.toUpperCase()}</a>)}
      </div>
      {err && <p className="text-sm text-red-300">{err}</p>}
      {!rows && !err && <div className="grid place-items-center py-12"><Loader2 className="h-5 w-5 animate-spin text-brand" /></div>}
      {rows && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead><tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-wide text-white/50"><th className="p-2">Parish</th><th>Zone / Area</th>{money && <><th>Type</th><th>Period</th><th className="text-right">Amount</th><th className="text-right">Confirmed</th></>}<th>Status</th>{money && <th>Reference</th>}</tr></thead>
            <tbody>
              {shown.map((r, i) => (
                <tr key={r.id + i} className="border-b border-white/5 align-top">
                  <td className="p-2 font-semibold">{r.parish}{r.note && <p className="text-xs font-normal text-white/45">{r.note}</p>}</td><td className="text-xs text-white/60">{r.zone}{r.area ? ` · ${r.area}` : ""}</td>
                  {money && <><td className="text-xs">{r.kind}<p className="text-white/45">{r.label}</p></td><td className="text-xs">{r.period}</td><td className="text-right tabular-nums">{formatNaira(r.amountKobo)}</td><td className="text-right tabular-nums">{r.confirmedKobo ? formatNaira(r.confirmedKobo) : "—"}</td></>}
                  <td><span className="badge">{statusText(r.status)}</span></td>{money && <td className="text-xs text-white/60">{r.reference || "—"}</td>}
                </tr>
              ))}
              {!shown.length && <tr><td colSpan={9} className="p-8 text-center text-white/50">No records behind this figure.</td></tr>}
            </tbody>
            {money && !!shown.length && <tfoot><tr className="border-t border-white/15 font-bold"><td className="p-2" colSpan={4}>{shown.length} record{shown.length === 1 ? "" : "s"}</td><td className="text-right tabular-nums">{formatNaira(total)}</td><td colSpan={3} /></tr></tfoot>}
          </table>
        </div>
      )}
    </Modal>
  );
}
