"use client";
import { motion } from "framer-motion";
import { Bot, CheckCircle2, Loader2, Mail, MessageSquare, RefreshCw, Sheet, Bell, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/fetcher";
import { cn } from "@/lib/cn";

export function IntegrationsPanel({ role }: { role: string }) {
  const toast = useToast();
  const [s, setS] = useState<any>(null);
  const [busy, setBusy] = useState("");
  const [testTo, setTestTo] = useState("");
  const load = () => api("/api/integrations").then(setS).catch((e) => toast.err(e.message));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);
  const sync = async (d: string) => { setBusy(d); try { const r = await api("/api/integrations", { method: "POST", json: { dataset: d } }); toast.ok(`Synced ${r.rows} rows to the “${r.tab}” tab`); } catch (e: any) { toast.err(e.message); } setBusy(""); };
  if (!s) return <div className="grid gap-4 md:grid-cols-2">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-40" />)}</div>;
  const Card = ({ icon: I, title, st, children, steps }: { icon: any; title: string; st: any; children?: React.ReactNode; steps: string[] }) => (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass p-5">
      <div className="flex items-center justify-between gap-3"><p className="flex items-center gap-2 font-bold"><I className="h-4 w-4 text-accent" />{title}</p><span className={cn("badge", st.active ? "badge-ok" : "badge-warn")}>{st.active ? <><CheckCircle2 className="h-3 w-3" />Active</> : <><XCircle className="h-3 w-3" />Not configured</>}</span></div>
      {children}
      {!st.active && <details className="mt-3 text-xs text-white/55"><summary className="cursor-pointer font-semibold text-white/70">How to turn it on</summary><ol className="mt-2 list-inside list-decimal space-y-1">{steps.map((x, i) => <li key={i}>{x}</li>)}</ol><p className="mt-2">Variables: <code className="text-accent">{st.needs.join(", ")}</code>. Add them in your hosting settings and redeploy.</p></details>}
    </motion.div>
  );
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card icon={Sheet} title="Google Sheets" st={s.sheets} steps={["In Google Cloud, create a service account and download its JSON key.", "Enable the Google Sheets API for that project.", "Create a Google Sheet and share it (Editor) with the service account's email.", "Set GOOGLE_SERVICE_ACCOUNT_JSON (the JSON, or base64 of it) and GOOGLE_SHEET_ID (from the sheet URL)."]}>
        <p className="mt-2 text-xs text-white/50">A reporting copy. MongoDB remains the source of truth. Each sync replaces the tab, so it never duplicates rows.</p>
        {s.sheets.active && <>
          <p className="mt-2 text-xs text-white/45">Share the sheet with <b className="break-all text-white/70">{s.sheets.serviceEmail}</b></p>
          <div className="mt-3 flex flex-wrap gap-2">{([["reports", "Reports"], ["remittances", "Finance"], ["attendance", "Attendance"]] as const).filter(([k]) => k !== "remittances" || ["super_admin", "finance_admin"].includes(role)).map(([k, l]) => <button key={k} className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => sync(k)}>{busy === k ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}Sync {l}</button>)}</div>
        </>}
      </Card>
      <Card icon={Mail} title="Email (Resend)" st={s.email} steps={["Create a Resend account and verify your sending domain.", "Create an API key.", "Set RESEND_API_KEY and MAIL_FROM (e.g. YAYA <no-reply@yourdomain.org>)."]}><p className="mt-2 text-xs text-white/50">Used for registration confirmations and password reset links.</p></Card>
      <Card icon={Bot} title="AI receipt reading" st={s.ai} steps={["Create an API key in the Anthropic Console.", "Set ANTHROPIC_API_KEY (and optionally ANTHROPIC_MODEL)."]}><p className="mt-2 text-xs text-white/50">Finance can ask for an advisory reading of a payment receipt (amount, date, reference). It never confirms or rejects a payment by itself.</p></Card>
      <Card icon={MessageSquare} title="SMS (Termii)" st={s.sms} steps={["Create an account at termii.com and get an API key.", "Register a sender ID with Termii (until approved, messages use their default route).", "Set TERMII_API_KEY and optionally TERMII_SENDER_ID, then redeploy."]}>
        <p className="mt-2 text-xs text-white/50">When active, people who register for an event get a text with their reference and ticket link. Each message is billed by Termii.</p>
        {s.sms.active && <form className="mt-3 flex gap-2" onSubmit={async (e) => { e.preventDefault(); setBusy("sms"); try { await api("/api/integrations/sms", { method: "POST", json: { to: testTo } }); toast.ok("Test message sent"); } catch (err: any) { toast.err(err.message); } setBusy(""); }}>
          <input className="input" placeholder="Phone number for a test" inputMode="tel" value={testTo} onChange={(e) => setTestTo(e.target.value)} aria-label="Phone number for a test message" />
          <button className="btn btn-ghost btn-sm shrink-0" disabled={busy === "sms" || !testTo}>{busy === "sms" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageSquare className="h-3.5 w-3.5" />}Send test</button>
        </form>}
      </Card>
      <Card icon={Bell} title="Push notifications" st={s.push} steps={["Run: npx web-push generate-vapid-keys", "Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY from the output (and optionally VAPID_SUBJECT, e.g. mailto:you@example.com).", "Redeploy. Visitors can then tap Turn on notifications on the Install and Announcements pages."]}>
        <p className="mt-2 text-xs text-white/50">New announcements are pushed to subscribed devices when published (you can untick this per announcement).</p>
        {s.push.active && <>
          <p className="mt-2 text-xs text-white/45">{s.push.subscribers} subscribed device{s.push.subscribers === 1 ? "" : "s"}.</p>
          <button className="btn btn-ghost btn-sm mt-3" disabled={busy === "push"} onClick={async () => { setBusy("push"); try { const r = await api("/api/integrations/push", { method: "POST", json: {} }); toast.ok(`Sent to ${r.sent} device(s)${r.removed ? `, removed ${r.removed} expired` : ""}`); load(); } catch (e: any) { toast.err(e.message); } setBusy(""); }}>{busy === "push" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bell className="h-3.5 w-3.5" />}Send a test notification</button>
        </>}
      </Card>
    </div>
  );
}
