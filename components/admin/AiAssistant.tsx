"use client";
import { motion } from "framer-motion";
import { Copy, Loader2, RotateCcw, Send, Sparkles, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { api } from "@/lib/fetcher";

const SUGGESTIONS = [
  "How many parishes have submitted their reports for last month?",
  "Which parishes have outstanding remittances for last month?",
  "Which zones have the highest report submission rate for last month?",
  "How much has been confirmed this month?",
  "Which receipts have possible duplicate references?",
  "Which areas have incomplete reports for last month?",
  "Summarize the monthly activity reports for last month.",
  "Compare youth attendance across the last three reporting periods.",
  "Which parishes need follow-up for last month?",
];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const fmt = (v?: string | null) => (v ? new Date(v).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" }) : "");

// ---- tiny, safe markdown (no HTML injection: everything is a React text node) ----
function inline(s: string): ReactNode[] {
  return s.split(/(\*\*[^*]+\*\*|\/admin\/[a-z\-/]+)/g).map((p, i) => p.startsWith("**") && p.endsWith("**") ? <b key={i}>{p.slice(2, -2)}</b> : /^\/admin\/[a-z\-/]+$/.test(p) ? <Link key={i} href={p} className="text-brand underline">{p}</Link> : <Fragment key={i}>{p}</Fragment>);
}
function Md({ text }: { text: string }) {
  const lines = text.split("\n"); const out: ReactNode[] = []; let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (/^\s*\|.*\|\s*$/.test(l)) {
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) { if (!/^\s*\|[\s:|-]+\|\s*$/.test(lines[i])) rows.push(lines[i].trim().slice(1, -1).split("|").map((c) => c.trim())); i++; }
      out.push(<div key={i} className="my-2 overflow-x-auto"><table className="w-full text-sm"><thead><tr>{rows[0]?.map((c, j) => <th key={j} className="border-b border-white/15 px-2 py-1.5 text-left text-xs font-bold uppercase tracking-wide text-white/60">{inline(c)}</th>)}</tr></thead><tbody>{rows.slice(1).map((r, j) => <tr key={j} className="border-b border-white/5">{r.map((c, k) => <td key={k} className="px-2 py-1.5">{inline(c)}</td>)}</tr>)}</tbody></table></div>);
      continue;
    }
    if (/^\s*([-*]|\d+\.)\s+/.test(l)) {
      const items: string[] = []; const ord = /^\s*\d+\./.test(l);
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*([-*]|\d+\.)\s+/, "")); i++; }
      const Tag = ord ? "ol" : "ul"; out.push(<Tag key={i} className={cn("my-2 space-y-1 pl-5", ord ? "list-decimal" : "list-disc")}>{items.map((t, j) => <li key={j}>{inline(t)}</li>)}</Tag>);
      continue;
    }
    if (/^#{1,4}\s/.test(l)) { out.push(<p key={i} className="mb-1 mt-3 font-bold">{inline(l.replace(/^#+\s/, ""))}</p>); i++; continue; }
    if (!l.trim()) { i++; continue; }
    out.push(<p key={i} className="my-1.5">{inline(l)}</p>); i++;
  }
  return <>{out}</>;
}

type Msg = { role: "user" | "assistant"; content: string; used?: { label: string; period: string; scope: string }[]; notice?: string | null; error?: boolean };

export function AiAssistant({ configured, canAsk, canWrite }: { configured: boolean; canAsk: boolean; canWrite: boolean; canReport?: boolean }) {
  const tabs = [...(canAsk ? ["Ask"] : []), ...(canWrite ? ["Write"] : []), "My AI history"] as const;
  const [tab, setTab] = useState<string>(tabs[0]);
  return (
    <>
      {!configured && <div className="glass mb-4 flex items-start gap-3 border-amber-400/30 p-4 text-sm"><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" /><p>The AI assistant isn't switched on yet. An administrator needs to add <code>ANTHROPIC_API_KEY</code> to the environment. Everything else on the platform works without it.</p></div>}
      <div className="glass mb-5 flex gap-1 overflow-x-auto p-1">{tabs.map((t) => <button key={t} onClick={() => setTab(t)} className={cn("relative whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold", tab === t ? "text-[#04130d]" : "text-white/60")}>{tab === t && <motion.span layoutId="ai-tab" className="absolute inset-0 rounded-xl bg-brand" />}<span className="relative">{t === "My AI history" ? "History" : t}</span></button>)}</div>
      {tab === "Ask" && <Ask disabled={!configured} />}
      {tab === "Write" && <Write disabled={!configured} canReport={canAsk} />}
      {tab === "My AI history" && <History />}
    </>
  );
}

function Ask({ disabled }: { disabled: boolean }) {
  const toast = useToast();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs, busy]);
  const send = async (text: string) => {
    const t = text.trim(); if (!t || busy) return;
    const next: Msg[] = [...msgs, { role: "user", content: t }]; setMsgs(next); setQ(""); setBusy(true);
    try {
      const r = await api("/api/ai/ask", { method: "POST", json: { messages: next.filter((m) => !m.error).map((m) => ({ role: m.role, content: m.content })) } });
      setMsgs([...next, { role: "assistant", content: r.answer, used: r.used, notice: r.notice }]);
    } catch (e: any) { setMsgs([...next, { role: "assistant", content: e.message, error: true }]); }
    setBusy(false);
  };
  return (
    <div className="space-y-4">
      {!msgs.length && (
        <div className="glass p-5">
          <p className="flex items-center gap-2 font-bold"><Sparkles className="h-4 w-4 text-accent" />Ask about your records</p>
          <p className="mt-1 text-sm text-white/60">Answers come from the live records your role can see, with the reporting period and scope shown. Confirmed money is always kept apart from pending money.</p>
          <div className="mt-4 flex flex-wrap gap-2">{SUGGESTIONS.map((s) => <button key={s} disabled={disabled} onClick={() => send(s)} className="rounded-full border border-white/15 px-3.5 py-1.5 text-left text-sm text-white/75 transition hover:border-brand hover:text-white disabled:opacity-40">{s}</button>)}</div>
        </div>
      )}
      <div className="space-y-3">
        {msgs.map((m, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={cn("max-w-3xl", m.role === "user" ? "ml-auto" : "")}>
            {m.role === "user" ? <div className="rounded-2xl rounded-br-md bg-brand/20 px-4 py-2.5 text-sm">{m.content}</div> : (
              <div className={cn("glass px-4 py-3 text-sm leading-relaxed", m.error && "border-red-400/30 text-red-200")}>
                {m.error ? m.content : <Md text={m.content} />}
                {m.notice && <p className="mt-2 rounded-lg bg-amber-500/10 p-2 text-xs text-amber-200">{m.notice}</p>}
                {!!m.used?.length && <div className="mt-3 flex flex-wrap gap-1.5 border-t border-white/10 pt-2.5">{m.used.map((u, j) => <span key={j} className="badge text-[11px]" title={`${u.label} · ${u.period} · ${u.scope}`}>{u.label} · {u.period} · {u.scope}</span>)}</div>}
                {!m.error && <button className="mt-2 inline-flex items-center gap-1 text-xs text-white/50 hover:text-white" onClick={() => { navigator.clipboard?.writeText(m.content).then(() => toast.ok("Copied")).catch(() => {}); }}><Copy className="h-3 w-3" />Copy</button>}
              </div>
            )}
          </motion.div>
        ))}
        {busy && <div className="glass flex max-w-xs items-center gap-2 px-4 py-3 text-sm text-white/60"><Loader2 className="h-4 w-4 animate-spin text-brand" />Checking the records…</div>}
        <div ref={end} />
      </div>
      <form className="glass sticky bottom-3 flex items-end gap-2 p-2" onSubmit={(e) => { e.preventDefault(); send(q); }}>
        <textarea className="input !border-0 !bg-transparent min-h-[44px] flex-1 resize-none" rows={1} maxLength={1500} placeholder="Ask a question about your records…" value={q} disabled={disabled} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(q); } }} aria-label="Your question" />
        {!!msgs.length && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMsgs([])} title="Start over"><RotateCcw className="h-4 w-4" /></button>}
        <button className="btn btn-primary" disabled={disabled || busy || !q.trim()}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</button>
      </form>
      <p className="text-center text-xs text-white/45">Read-only: the assistant can't approve payments, change amounts, edit reports or send messages. Those stay with you.</p>
    </div>
  );
}

const KINDS: [string, string][] = [["announcement", "Announcement"], ["invitation", "Invitation"], ["meeting_notice", "Meeting notice"], ["reminder", "Reminder"], ["report_summary", "Report summary"], ["admin_message", "Administrative message"]];
const TONES: [string, string][] = [["warm", "Warm"], ["formal", "Formal"], ["urgent", "Urgent but polite"], ["celebratory", "Celebratory"]];

function Write({ disabled, canReport }: { disabled: boolean; canReport: boolean }) {
  const toast = useToast(); const router = useRouter();
  const now = new Date(); const prev = now.getMonth() === 0 ? { m: 12, y: now.getFullYear() - 1 } : { m: now.getMonth(), y: now.getFullYear() };
  const [f, setF] = useState({ kind: "announcement", tone: "warm", brief: "", audience: "", facts: "", month: prev.m, year: prev.y });
  const [d, setD] = useState<{ title: string; body: string; placeholders: string[]; used: any[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const kinds = KINDS.filter(([k]) => k !== "report_summary" || canReport);
  const go = async () => {
    setBusy(true);
    try { setD(await api("/api/ai/draft", { method: "POST", json: { kind: f.kind, tone: f.tone, brief: f.brief, audience: f.audience || undefined, facts: f.facts || undefined, ...(f.kind === "report_summary" ? { period: { month: f.month, year: f.year } } : {}) } })); }
    catch (e: any) { toast.err(e.message); }
    setBusy(false);
  };
  const stillHas = d ? [...new Set([...(d.title + "\n" + d.body).matchAll(/\[[^\]\n]{1,40}\]/g)].map((x) => x[0]))] : [];
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="glass space-y-4 p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="label">What to write</label><select className="input" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{kinds.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
          <div><label className="label">Tone</label><select className="input" value={f.tone} onChange={(e) => setF({ ...f, tone: e.target.value })}>{TONES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
        </div>
        {f.kind === "report_summary" && <div className="grid gap-3 sm:grid-cols-2"><div><label className="label">Reporting month</label><select className="input" value={f.month} onChange={(e) => setF({ ...f, month: +e.target.value })}>{MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select></div><div><label className="label">Year</label><input className="input" type="number" value={f.year} onChange={(e) => setF({ ...f, year: +e.target.value })} /></div></div>}
        <div><label className="label">Who is it for? (optional)</label><input className="input" maxLength={200} placeholder="e.g. all parish youth leaders" value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value })} /></div>
        <div><label className="label">{f.kind === "report_summary" ? "What should the summary focus on?" : "What do you want to say?"}</label><textarea className="input min-h-[110px]" maxLength={2000} placeholder={f.kind === "report_summary" ? "e.g. a short note for the provincial council" : "e.g. Invite everyone to the youth convention and remind them to register"} value={f.brief} onChange={(e) => setF({ ...f, brief: e.target.value })} /></div>
        <div><label className="label">Exact details to include (optional)</label><textarea className="input min-h-[70px]" maxLength={2000} placeholder="Date, time, venue, deadline, contact… Anything left out becomes a [placeholder]." value={f.facts} onChange={(e) => setF({ ...f, facts: e.target.value })} /></div>
        <button className="btn btn-primary w-full" disabled={disabled || busy || f.brief.trim().length < 5} onClick={go}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}Write a draft</button>
      </div>
      <div className="glass space-y-3 p-5">
        {!d && <p className="text-sm text-white/50">Your draft will appear here. You can edit it, copy it, or open it in Communications. Nothing is sent until you choose to.</p>}
        {d && <>
          <div><label className="label">Title</label><input className="input" value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} /></div>
          <div><label className="label">Message</label><textarea className="input min-h-[240px]" value={d.body} onChange={(e) => setD({ ...d, body: e.target.value })} /></div>
          {stillHas.length > 0 && <p className="flex items-start gap-2 rounded-lg bg-amber-500/10 p-2.5 text-xs text-amber-200"><TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />Fill in before sending: {stillHas.join(", ")}</p>}
          {!!d.used?.length && <div className="flex flex-wrap gap-1.5">{d.used.map((u, j) => <span key={j} className="badge text-[11px]">{u.label} · {u.period} · {u.scope}</span>)}</div>}
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-ghost" onClick={() => navigator.clipboard?.writeText(`${d.title}\n\n${d.body}`).then(() => toast.ok("Copied")).catch(() => {})}><Copy className="h-4 w-4" />Copy</button>
            <button className="btn btn-primary" onClick={() => { try { sessionStorage.setItem("comms-prefill", JSON.stringify({ title: d.title, body: d.body })); } catch { /* ignore */ } router.push("/admin/notifications"); }}><Send className="h-4 w-4" />Use in Communications</button>
          </div>
          <p className="text-xs text-white/45">AI-written draft. Check every detail before it goes out; you choose the audience and press Send yourself.</p>
        </>}
      </div>
    </div>
  );
}

function History() {
  const toast = useToast();
  const [d, setD] = useState<any>(null);
  const [open, setOpen] = useState("");
  useEffect(() => { api("/api/ai/log").then(setD).catch((e) => { toast.err(e.message); setD({ rows: [] }); }); }, [toast]);
  if (!d) return <div className="skeleton h-24" />;
  return (
    <div className="space-y-2">
      <p className="text-xs text-white/50">{d.all ? "Everything the assistant was asked, by anyone, and which read-only tools it used." : "Your own requests, and which read-only tools were used."} Kept for 180 days.</p>
      {d.rows.map((l: any) => (
        <div key={l.id} className="glass px-4 py-3 text-sm">
          <button className="flex w-full flex-wrap items-center justify-between gap-2 text-left" onClick={() => setOpen(open === l.id ? "" : l.id)}>
            <span className="min-w-0 flex-1 truncate font-semibold">{l.question}</span>
            <span className="text-xs text-white/50">{d.all ? `${l.who} · ` : ""}{l.kind === "draft" ? "writing" : "question"} · {fmt(l.at)}{l.error ? " · failed" : ""}</span>
          </button>
          {open === l.id && <div className="mt-3 space-y-2 border-t border-white/10 pt-3"><div className="flex flex-wrap gap-1.5">{l.tools.map((t: any, i: number) => <span key={i} className={cn("badge text-[11px]", t.error && "badge-bad")} title={t.args}>{t.name}{t.error ? " (refused)" : ""}</span>)}{!l.tools.length && <span className="text-xs text-white/40">No data tools used</span>}</div>{l.error ? <p className="text-red-300">{l.error}</p> : <p className="whitespace-pre-wrap text-white/75">{l.answer}</p>}</div>}
        </div>
      ))}
      {!d.rows.length && <div className="glass p-10 text-center text-white/50">Nothing yet.</div>}
    </div>
  );
}
