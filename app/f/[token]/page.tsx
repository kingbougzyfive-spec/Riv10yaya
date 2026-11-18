"use client";
import { Loader2, LockKeyhole, ShieldCheck } from "lucide-react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ReportWizard } from "@/components/admin/ReportWizard";
import { EventRecordFields } from "@/components/event/EventRecordFields";
import { formatNaira } from "@/lib/money";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/fetcher";

type Info = { state: "invalid" | "ok" | "expired" | "revoked" | "locked"; message?: string; purpose?: "monthly" | "event"; unit?: string; unitType?: string; title?: string; period?: string; month?: number | null; year?: number | null; madeBy?: string; expiresAt?: string };

export default function FillLinkPage() {
  const { token } = useParams<{ token: string }>();
  const toast = useToast();
  const base = `/api/fill/${token}`;
  const [info, setInfo] = useState<Info | null>(null);
  const [open, setOpen] = useState<boolean | null>(null); // null = checking whether this browser already entered the password
  const [f, setF] = useState({ name: "", phone: "", password: "" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const i: Info = await api(`${base}/info`);
      setInfo(i);
      if (i.state !== "ok") return setOpen(false);
      // Already unlocked in this browser a moment ago? Then go straight to the form.
      try { await api(i.purpose === "monthly" ? `${base}/context` : `${base}/event`); setOpen(true); } catch { setOpen(false); }
    } catch (e: any) { setInfo({ state: "invalid", message: e.message }); setOpen(false); }
  }, [base]);
  useEffect(() => { load(); }, [load]);

  async function unlock(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try { await api(`${base}/unlock`, { method: "POST", json: f }); setOpen(true); }
    catch (er: any) { toast.err(er.message); await load(); }
    setBusy(false);
  }

  const shell = (children: React.ReactNode, wide = false) => (
    <main className="min-h-dvh px-4 py-8">
      <div className={`mx-auto ${wide ? "max-w-3xl" : "max-w-md"}`}>
        <p className="mb-5 flex items-center gap-2 text-sm font-semibold text-white/80"><ShieldCheck className="h-4 w-4 text-brand" aria-hidden="true" />RCCG Rivers 10 YAYA · Secure form</p>
        {children}
      </div>
    </main>
  );

  if (!info || open === null) return shell(<div className="space-y-3" role="status" aria-label="Loading"><div className="skeleton h-24" /><div className="skeleton h-48" /></div>);

  if (info.state !== "ok") {
    return shell(
      <div className="glass p-8 text-center" role="alert">
        <h1 className="text-xl font-bold">{info.state === "invalid" ? "This link isn't valid" : info.state === "locked" ? "Locked for a little while" : info.state === "expired" ? "This link has expired" : "This link was cancelled"}</h1>
        <p className="mt-2 text-sm text-white/70">{info.state === "invalid" ? "Check that you copied the whole link, or ask the person who sent it to send it again." : info.message}</p>
      </div>,
    );
  }

  if (!open) {
    return shell(
      <form onSubmit={unlock} className="glass space-y-4 p-6">
        <div>
          <LockKeyhole className="mb-3 h-8 w-8 text-brand" aria-hidden="true" />
          <h1 className="text-xl font-bold">{info.title}</h1>
          <p className="mt-1 text-sm text-white/70">For <strong>{info.unit}</strong>{info.period ? <> · {info.period}</> : null}. Sent to you by {info.madeBy}.</p>
        </div>
        <div><label className="label">Your full name</label><input className="input" required minLength={2} autoComplete="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div><label className="label">Your phone number</label><input className="input" required inputMode="tel" autoComplete="tel" placeholder="0803 000 0000" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
        <div><label className="label">Password</label><PasswordInput className="input" required autoComplete="off" autoCapitalize="characters" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /><p className="hint">{info.madeBy} gave you this password separately from the link.</p></div>
        <button className="btn btn-primary w-full py-3" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}Open the form</button>
        <p className="text-center text-xs text-white/65">Your name and number are recorded with everything you submit.</p>
      </form>,
    );
  }

  if (info.purpose === "monthly") {
    return shell(
      <ReportWizard
        endpoints={{ context: () => `${base}/context`, remittance: `${base}/remittance`, report: `${base}/report`, evidence: `${base}/evidence` }}
        fixedPeriod={{ month: info.month ?? 1, year: info.year ?? new Date().getFullYear() }}
      />,
      true,
    );
  }
  return shell(<EventLink base={base} />);
}

/** The event record form opened from a link: the same fields the signed-in screen uses. */
function EventLink({ base }: { base: string }) {
  const toast = useToast();
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<any>(null);
  useEffect(() => { api(`${base}/event`).then(setD).catch((e) => setErr(e.message)); }, [base]);
  if (err) return <div className="glass p-6 text-center" role="alert"><p>{err}</p></div>;
  if (!d) return <div className="skeleton h-64" />;
  if (done) {
    return (
      <div className="glass space-y-2 p-6 text-center" role="status">
        <ShieldCheck className="mx-auto h-10 w-10 text-brand" aria-hidden="true" />
        <h1 className="text-xl font-bold">Thank you. Your record is saved.</h1>
        <p className="text-sm text-white/75">{d.unit.name}: <strong>{done.total}</strong> in total ({done.males} males, {done.females} females){d.form.collectOffering && done.offeringKobo != null ? ` · ${formatNaira(done.offeringKobo)} offering` : ""}.</p>
        <p className="text-xs text-white/65">You can close this page. If you made a mistake, open the link again and correct it.</p>
        <button className="btn btn-ghost mt-2" onClick={() => { setD({ ...d, record: done }); setDone(null); }}>Change the numbers</button>
      </div>
    );
  }
  return (
    <div className="glass space-y-4 p-6">
      <div><h1 className="text-xl font-bold">{d.form.title}</h1><p className="text-sm text-white/70">For <strong>{d.unit.name}</strong> · {new Date(d.form.eventDate).toLocaleDateString("en-NG", { dateStyle: "long" })}{d.form.venue ? ` · ${d.form.venue}` : ""}</p>{d.form.description && <p className="mt-1 text-sm text-white/65">{d.form.description}</p>}</div>
      {d.form.status !== "open" ? <p className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 text-sm" role="alert">This form is closed, so records can't be changed any more.</p> : (
        <EventRecordFields form={d.form} initial={d.record} busy={busy} submitLabel={d.record ? "Update the record" : "Submit the record"} note={d.record ? "A record was already saved for this. Saving replaces those numbers." : undefined}
          onSubmit={async (v) => { setBusy(true); try { setDone(await api(`${base}/event`, { method: "POST", json: v })); } catch (e: any) { toast.err(e.message); } setBusy(false); }} />
      )}
    </div>
  );
}
