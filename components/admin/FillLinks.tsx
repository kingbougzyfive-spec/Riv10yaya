"use client";
import { Ban, CalendarPlus, Check, Copy, KeyRound, Link2, Loader2, Share2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/fetcher";
import { MONTHS } from "@/lib/money";

type Level = "parish" | "area" | "zone" | "province";
const LEVELS_BY_ROLE: Record<string, Level[]> = { parish_admin: ["parish"], area_admin: ["parish", "area"], zonal_admin: ["parish", "area", "zone"], provincial_admin: ["parish", "area", "zone"], super_admin: ["parish", "area", "zone"] };
const byLabel = (a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: "base" });
const STATE: Record<string, { label: string; cls: string }> = { ok: { label: "Active", cls: "badge-ok" }, expired: { label: "Expired", cls: "badge-warn" }, revoked: { label: "Cancelled", cls: "badge-bad" }, locked: { label: "Locked (wrong passwords)", cls: "badge-warn" } };
const fmt = (d?: string) => (d ? new Date(d).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" }) : "");

async function copy(text: string, toast: ReturnType<typeof useToast>, what: string) {
  try { await navigator.clipboard.writeText(text); toast.ok(`${what} copied.`); }
  catch { toast.err("Couldn't copy. Select the text and copy it yourself."); }
}

export function FillLinks({ role }: { role: string }) {
  const toast = useToast();
  const confirm = useConfirm();
  const now = new Date();
  const levels = LEVELS_BY_ROLE[role] ?? ["parish"];
  const [org, setOrg] = useState<any>(null);
  const [links, setLinks] = useState<any[] | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [loadErr, setLoadErr] = useState("");
  const [f, setF] = useState({ purpose: "monthly" as "monthly" | "event", level: levels[0], unit: "", month: now.getMonth() + 1, year: now.getFullYear(), eventForm: "", label: "", days: 7, own: false, password: "", q: "" });
  const [busy, setBusy] = useState(false);
  const [made, setMade] = useState<{ url: string; password: string; expiresAt: string; what: string } | null>(null);

  const load = useCallback(() => api("/api/links").then((d) => { setLinks(d.links); setLoadErr(""); }).catch((e) => setLoadErr(e.message)), []);
  useEffect(() => { load(); api("/api/org").then(setOrg).catch(() => {}); api("/api/event-forms?open=1").then((d) => setEvents(d.forms ?? [])).catch(() => {}); }, [load]);

  const ev = events.find((e) => e.id === f.eventForm);
  const level: Level = f.purpose === "event" ? (ev?.level ?? "parish") : f.level;
  const options = useMemo((): { id: string; label: string }[] => {
    if (!org) return [];
    const zn = (id: string) => org.zones.find((z: any) => z.id === id)?.name ?? "";
    const an = (id: string | null) => (id ? org.areas.find((a: any) => a.id === id)?.name ?? "" : "");
    const all = level === "zone" ? org.zones.map((z: any) => ({ id: z.id, label: z.name }))
      : level === "area" ? org.areas.map((a: any) => ({ id: a.id, label: `${a.name} (${zn(a.zone)})` }))
      : level === "parish" ? org.parishes.filter((p: any) => p.active !== false).map((p: any) => ({ id: p.id, label: `${p.name} (${[an(p.area), zn(p.zone)].filter(Boolean).join(", ")})` })) : [];
    const n = f.q.trim().toLowerCase();
    return all.filter((o: any) => !n || o.label.toLowerCase().includes(n)).sort(byLabel);
  }, [org, level, f.q]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (f.purpose === "event" && !f.eventForm) return toast.err("Choose the event form.");
    if (level !== "province" && !f.unit) return toast.err(`Choose the ${level}.`);
    if (f.own && f.password.trim().length < 6) return toast.err("The password must be at least 6 characters.");
    setBusy(true);
    try {
      const r = await api("/api/links", { method: "POST", json: {
        purpose: f.purpose, unit: { type: level, id: level === "province" ? undefined : f.unit }, ...(f.purpose === "monthly" ? { month: f.month, year: f.year } : { eventForm: f.eventForm }),
        label: f.label, expiresInDays: f.days, ...(f.own ? { password: f.password.trim() } : {}),
      } });
      const unitName = options.find((o) => o.id === f.unit)?.label ?? "the whole province";
      setMade({ url: `${window.location.origin}${r.path}`, password: r.password, expiresAt: r.expiresAt, what: f.purpose === "monthly" ? `${level === "parish" ? "Monthly report and remittance" : "Monthly report"} · ${unitName} · ${MONTHS[f.month - 1]} ${f.year}` : `${ev?.title} · ${unitName}` });
      setF((s) => ({ ...s, label: "", unit: "", password: "" }));
      await load();
    } catch (er: any) { toast.err(er.message); }
    setBusy(false);
  }

  async function act(l: any, action: "revoke" | "reset_password" | "extend") {
    if (action === "revoke" && !(await confirm({ title: "Cancel this link?", message: "Nobody will be able to open it again, even with the password. Anything already submitted stays.", confirmLabel: "Cancel link" }))) return;
    if (action === "reset_password" && !(await confirm({ title: "Make a new password?", message: "The old password stops working straight away, and anyone who already has the form open is signed out of it.", confirmLabel: "New password" }))) return;
    try {
      const r = await api("/api/links", { method: "PATCH", json: { id: l.id, action, days: 7 } });
      if (action === "reset_password") setMade({ url: `${window.location.origin}${l.path}`, password: r.password, expiresAt: l.expiresAt, what: `${l.unit}${l.period ? ` · ${l.period}` : ""} (new password)` });
      else toast.ok(action === "revoke" ? "Link cancelled." : "Link extended by 7 days.");
      await load();
    } catch (er: any) { toast.err(er.message); }
  }

  const message = made && `${made.what}\nOpen: ${made.url}\n(You will also need the password. It is sent separately.)`;
  return (
    <div className="space-y-6">
      {made && (
        <section className="glass space-y-3 border-brand/40 p-5" aria-live="polite">
          <p className="flex items-center gap-2 font-semibold"><Check className="h-5 w-5 text-brand" aria-hidden="true" />Your link is ready</p>
          <p className="text-sm text-white/75">{made.what}</p>
          <div className="rounded-xl border border-white/10 p-3"><p className="text-xs uppercase tracking-wider text-white/65">Link</p><p className="mt-1 break-all font-mono text-sm">{made.url}</p></div>
          <div className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-3"><p className="text-xs uppercase tracking-wider text-white/65">Password (shown only now)</p><p className="mt-1 font-mono text-xl font-bold tracking-widest">{made.password}</p></div>
          <p className="text-xs text-white/65">Send the link and the password in <strong>two separate messages</strong>. Valid until {fmt(made.expiresAt)}. If you lose the password you can make a new one from the list below.</p>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-sm btn-primary" onClick={() => copy(made.url, toast, "Link")}><Copy className="h-4 w-4" />Copy link</button>
            <button className="btn btn-sm btn-primary" onClick={() => copy(made.password, toast, "Password")}><KeyRound className="h-4 w-4" />Copy password</button>
            {typeof navigator !== "undefined" && "share" in navigator && <button className="btn btn-sm btn-ghost" onClick={() => navigator.share({ title: "Rivers 10 YAYA form", text: message!, url: made.url }).catch(() => {})}><Share2 className="h-4 w-4" />Share link</button>}
            <button className="btn btn-sm btn-ghost" onClick={() => setMade(null)}>Done</button>
          </div>
        </section>
      )}

      <form onSubmit={create} className="glass space-y-4 p-5">
        <h2 className="flex items-center gap-2 text-lg font-bold"><Link2 className="h-5 w-5 text-brand" aria-hidden="true" />Make a new link</h2>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="What is the link for">
          {([["monthly", "Monthly report & remittance"], ["event", "Event record"]] as const).map(([v, l]) => (
            <button type="button" key={v} role="radio" aria-checked={f.purpose === v} onClick={() => setF({ ...f, purpose: v, unit: "", q: "" })} className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${f.purpose === v ? "border-brand bg-brand/20" : "border-white/15 text-white/75 hover:bg-white/5"}`}>{l}</button>
          ))}
        </div>

        {f.purpose === "monthly" && levels.length > 1 && (
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${levels.length}, minmax(0, 1fr))` }} role="radiogroup" aria-label="Level">
            {levels.map((l) => <button type="button" key={l} role="radio" aria-checked={f.level === l} onClick={() => setF({ ...f, level: l, unit: "", q: "" })} className={`rounded-xl border px-3 py-2 text-sm font-semibold capitalize transition ${f.level === l ? "border-brand bg-brand/20" : "border-white/15 text-white/75 hover:bg-white/5"}`}>{l}</button>)}
          </div>
        )}
        {f.purpose === "event" && (
          <div><label className="label">Event form</label>
            <select className="input" value={f.eventForm} onChange={(e) => setF({ ...f, eventForm: e.target.value, unit: "", q: "" })}>
              <option value="">{events.length ? "Choose the event…" : "No open event forms yet"}</option>
              {events.map((e) => <option key={e.id} value={e.id}>{e.title} (one record per {e.level})</option>)}
            </select>
          </div>
        )}
        {(f.purpose === "monthly" || ev) && level !== "province" && (
          <div>
            <label className="label capitalize">Which {level}?</label>
            {options.length > 8 || f.q ? <input className="input mb-2" placeholder={`Type to find the ${level}…`} value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} aria-label={`Search ${level}`} /> : null}
            <select className="input" value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })}>
              <option value="">{org ? `Choose the ${level}…` : "Loading…"}</option>
              {options.slice(0, 250).map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
            {org && options.length === 0 && <p className="hint">Nothing matches. Only units you are in charge of are listed.</p>}
          </div>
        )}
        {f.purpose === "monthly" && (
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Month</label><select className="input" value={f.month} onChange={(e) => setF({ ...f, month: Number(e.target.value) })}>{MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select></div>
            <div><label className="label">Year</label><select className="input" value={f.year} onChange={(e) => setF({ ...f, year: Number(e.target.value) })}>{[now.getFullYear(), now.getFullYear() - 1].map((y) => <option key={y} value={y}>{y}</option>)}</select></div>
          </div>
        )}
        <div><label className="label">Who is it for? <span className="font-normal text-white/65">(optional, just for your own list)</span></label><input className="input" maxLength={80} placeholder="e.g. Parish secretary" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} /></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="label">Link lasts</label><select className="input" value={f.days} onChange={(e) => setF({ ...f, days: Number(e.target.value) })}>{[1, 3, 7, 14, 30].map((d) => <option key={d} value={d}>{d === 1 ? "1 day" : `${d} days`}</option>)}</select></div>
          <div>
            <label className="label">Password</label>
            <div className="flex gap-2" role="radiogroup" aria-label="Password">
              {([[false, "Make one for me"], [true, "I'll choose"]] as const).map(([v, l]) => <button type="button" key={l} role="radio" aria-checked={f.own === v} onClick={() => setF({ ...f, own: v })} className={`flex-1 rounded-xl border px-2 py-2.5 text-xs font-semibold transition ${f.own === v ? "border-brand bg-brand/20" : "border-white/15 text-white/75"}`}>{l}</button>)}
            </div>
          </div>
        </div>
        {f.own && <div><PasswordInput className="input" placeholder="At least 6 characters" autoComplete="off" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} aria-label="Your password for this link" /></div>}
        <button className="btn btn-primary w-full py-3" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}Make the link</button>
      </form>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">Your links</h2>
        {!links && !loadErr && <div className="skeleton h-24" />}
        {loadErr && <div className="glass p-5 text-center" role="alert"><p>{loadErr}</p><button className="btn btn-primary mt-3" onClick={load}>Try again</button></div>}
        {links?.length === 0 && <div className="glass p-6 text-center text-sm text-white/65">No links yet. Make one above.</div>}
        {links?.map((l) => (
          <article key={l.id} className="glass space-y-2 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0"><p className="font-semibold">{l.purpose === "monthly" ? (l.unitType === "parish" ? "Report & remittance" : "Monthly report") : l.event || "Event record"} <span className="font-normal text-white/70">· {l.unit}</span></p><p className="text-xs text-white/65">{[l.period, l.label, !l.mine && `made by ${l.createdByName}`].filter(Boolean).join(" · ")}</p></div>
              <span className={`badge ${STATE[l.state]?.cls}`}>{STATE[l.state]?.label ?? l.state}</span>
            </div>
            <p className="text-xs text-white/65">Expires {fmt(l.expiresAt)} · opened {l.opens} time{l.opens === 1 ? "" : "s"}{l.lastFilledBy ? ` · last by ${l.lastFilledBy}` : ""}</p>
            <p className="flex flex-wrap gap-1.5 text-xs">
              {l.purpose === "monthly" && l.unitType === "parish" && <span className={`badge ${l.remittanceAt ? "badge-ok" : ""}`}>Remittance {l.remittanceAt ? "submitted" : "not yet"}</span>}
              {l.purpose === "monthly" && <span className={`badge ${l.reportAt ? "badge-ok" : ""}`}>Report {l.reportAt ? "submitted" : "not yet"}</span>}
              {l.purpose === "event" && <span className={`badge ${l.recordAt ? "badge-ok" : ""}`}>Record {l.recordAt ? "submitted" : "not yet"}</span>}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <button className="btn btn-sm btn-ghost" onClick={() => copy(`${window.location.origin}${l.path}`, toast, "Link")}><Copy className="h-4 w-4" />Copy link</button>
              {l.state !== "revoked" && <button className="btn btn-sm btn-ghost" onClick={() => act(l, "reset_password")}><KeyRound className="h-4 w-4" />New password</button>}
              {(l.state === "expired" || l.state === "ok") && <button className="btn btn-sm btn-ghost" onClick={() => act(l, "extend")}><CalendarPlus className="h-4 w-4" />+7 days</button>}
              {l.state !== "revoked" && <button className="btn btn-sm btn-ghost" onClick={() => act(l, "revoke")}><Ban className="h-4 w-4" />Cancel</button>}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
