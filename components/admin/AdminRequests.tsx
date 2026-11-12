"use client";
import { Check, Loader2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/fetcher";

const ROLE: Record<string, string> = { zone: "Zonal administrator", area: "Area administrator", parish: "Parish administrator" };
type Link = { zone?: string; area?: string; parish?: string };

export function AdminRequests() {
  const toast = useToast();
  const confirm = useConfirm();
  const [rows, setRows] = useState<any[] | null>(null);
  const [org, setOrg] = useState<any>({ zones: [], areas: [], parishes: [] });
  const [tab, setTab] = useState<"pending" | "reviewed">("pending");
  const [busy, setBusy] = useState("");
  const [rejecting, setRejecting] = useState("");
  const [reason, setReason] = useState("");
  const [link, setLink] = useState<Record<string, Link>>({});
  const load = useCallback(() => api("/api/admin-requests").then((d) => setRows(d.requests)).catch((e) => { toast.err(e.message); setRows([]); }), [toast]);
  useEffect(() => { load(); api("/api/org").then(setOrg).catch(() => {}); }, [load]);
  const setL = (id: string, patch: Link) => setLink((s) => ({ ...s, [id]: { ...s[id], ...patch } }));

  async function act(r: any, action: "approve" | "reject") {
    const l = link[r.id] || {};
    if (action === "approve") {
      const creates = [!r.zoneId && !l.zone ? `zone "${r.zoneName}"` : "", r.level !== "zone" && r.zoneHasAreas !== false && !r.areaId && !l.area && r.areaName ? `area "${r.areaName}"` : "", r.level === "parish" && !r.parishId && !l.parish ? `parish "${r.parishName}"` : ""].filter(Boolean);
      if (!(await confirm({ title: `Approve ${r.name}?`, message: `This creates a ${ROLE[r.level].toLowerCase()} account for ${r.orgName}.${creates.length ? ` It will also add ${creates.join(", ")} to your structure.` : ""} They can sign in straight away.`, confirmLabel: "Approve" }))) return;
    }
    setBusy(r.id);
    try { await api(`/api/admin-requests/${r.id}`, { method: "PATCH", json: { action, reason: action === "reject" ? reason : undefined, ...(action === "approve" ? l : {}) } }); toast.ok(action === "approve" ? "Approved. Their account is ready." : "Request rejected."); setRejecting(""); setReason(""); await load(); api("/api/org").then(setOrg).catch(() => {}); }
    catch (e: any) { toast.err(e.message); }
    setBusy("");
  }

  if (!rows) return <p className="text-sm text-white/65" role="status">Loading…</p>;
  const list = rows.filter((r) => (tab === "pending") === (r.status === "pending"));
  const pending = rows.filter((r) => r.status === "pending").length;

  const Part = ({ r, kind, label, typed, matchedId, options, show }: { r: any; kind: keyof Link; label: string; typed: string; matchedId: string; options: any[]; show: boolean }) => {
    if (!show || !typed) return null;
    const chosen = link[r.id]?.[kind];
    const matched = matchedId || chosen;
    return (
      <div className="rounded-xl border border-white/10 p-3 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span><span className="text-white/65">{label}: </span><span className="font-medium">{typed}</span></span>
          <span className={`badge ${matched ? "badge-ok" : "badge-warn"}`}>{matched ? "Already in your structure" : "New, will be created"}</span>
        </div>
        {!matchedId && r.status === "pending" && options.length > 0 && (
          <label className="mt-2 block text-xs text-white/65">Spelled differently? Link to an existing one instead
            <select className="input mt-1" value={chosen || ""} onChange={(e) => setL(r.id, { [kind]: e.target.value || undefined } as Link)}>
              <option value="">Create "{typed}" as new</option>{options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </label>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2" role="tablist">
        {(["pending", "reviewed"] as const).map((t) => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`btn btn-sm ${tab === t ? "btn-primary" : "btn-ghost"}`}>{t === "pending" ? `Waiting (${pending})` : "Reviewed"}</button>)}
      </div>
      {list.length === 0 && <div className="glass p-8 text-center text-sm text-white/65">{tab === "pending" ? "No requests are waiting." : "Nothing reviewed yet."}</div>}
      {list.map((r) => {
        const zoneId = r.zoneId || link[r.id]?.zone || "";
        const zoneObj = org.zones.find((z: any) => z.id === zoneId);
        const areaOptions = org.areas.filter((a: any) => !zoneId || a.zone === zoneId);
        const parishOptions = org.parishes.filter((p: any) => (!zoneId || p.zone === zoneId) && (!(r.areaId || link[r.id]?.area) || p.area === (r.areaId || link[r.id]?.area)));
        const wantsArea = r.level === "area" || (r.level === "parish" && (zoneObj ? zoneObj.hasAreas : !!r.areaName));
        return (
          <div key={r.id} className="glass space-y-3 p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div><p className="font-semibold">{r.name}</p><p className="text-sm text-white/70">{r.email}{r.phone ? ` · ${r.phone}` : ""}</p></div>
              <span className={`badge ${r.status === "approved" ? "badge-ok" : r.status === "rejected" ? "badge-bad" : "badge-warn"}`}>{r.status}</span>
            </div>
            <p className="text-sm"><span className="text-white/65">Wants to be: </span><span className="font-medium">{ROLE[r.level]}</span></p>
            <div className="space-y-2">
              <Part r={r} kind="zone" label="Zone" typed={r.zoneName} matchedId={r.zoneId} options={org.zones} show />
              <Part r={r} kind="area" label="Area" typed={r.areaName} matchedId={r.areaId} options={areaOptions} show={wantsArea} />
              <Part r={r} kind="parish" label="Parish" typed={r.parishName} matchedId={r.parishId} options={parishOptions} show={r.level === "parish"} />
            </div>
            {r.status === "pending" && r.existingAdmins > 0 && <p className="badge-warn rounded-xl p-2.5 text-xs">{r.existingAdmins} active administrator{r.existingAdmins > 1 ? "s" : ""} already manage{r.existingAdmins > 1 ? "" : "s"} this {r.level}. Make sure this person should also have access.</p>}
            {r.status !== "pending" && <p className="text-xs text-white/65">{r.status === "approved" ? "Approved" : "Rejected"}{r.reviewedBy ? ` by ${r.reviewedBy}` : ""}{r.reason ? `. Reason: ${r.reason}` : ""}</p>}
            {r.status === "pending" && (rejecting === r.id ? (
              <div className="flex flex-wrap items-center gap-2">
                <input className="input min-w-0 flex-1" placeholder="Reason (optional, they will see it)" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Reason for rejecting" />
                <button className="btn btn-sm btn-ghost" onClick={() => { setRejecting(""); setReason(""); }}>Cancel</button>
                <button className="btn btn-sm btn-primary" disabled={busy === r.id} onClick={() => act(r, "reject")}>{busy === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}Confirm reject</button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button className="btn btn-sm btn-primary" disabled={busy === r.id} onClick={() => act(r, "approve")}>{busy === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Approve</button>
                <button className="btn btn-sm btn-ghost" onClick={() => setRejecting(r.id)}>Reject</button>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
