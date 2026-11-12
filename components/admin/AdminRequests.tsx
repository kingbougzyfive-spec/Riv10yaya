"use client";
import { Check, Loader2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/fetcher";

const ROLE: Record<string, string> = { zone: "Zonal administrator", area: "Area administrator", parish: "Parish administrator" };

export function AdminRequests() {
  const toast = useToast();
  const confirm = useConfirm();
  const [rows, setRows] = useState<any[] | null>(null);
  const [tab, setTab] = useState<"pending" | "reviewed">("pending");
  const [busy, setBusy] = useState("");
  const [rejecting, setRejecting] = useState("");
  const [reason, setReason] = useState("");
  const load = useCallback(() => api("/api/admin-requests").then((d) => setRows(d.requests)).catch((e) => { toast.err(e.message); setRows([]); }), [toast]);
  useEffect(() => { load(); }, [load]);

  async function act(r: any, action: "approve" | "reject") {
    if (action === "approve" && !(await confirm({ title: `Approve ${r.name}?`, message: `This creates a ${ROLE[r.level].toLowerCase()} account for ${r.orgName}${r.isNew ? ` and adds "${r.orgName}" to your structure` : ""}. They can sign in straight away.`, confirmLabel: "Approve" }))) return;
    setBusy(r.id);
    try { await api(`/api/admin-requests/${r.id}`, { method: "PATCH", json: { action, reason: action === "reject" ? reason : undefined } }); toast.ok(action === "approve" ? "Approved. Their account is ready." : "Request rejected."); setRejecting(""); setReason(""); await load(); }
    catch (e: any) { toast.err(e.message); }
    setBusy("");
  }

  if (!rows) return <p className="text-sm text-white/65" role="status">Loading…</p>;
  const list = rows.filter((r) => (tab === "pending") === (r.status === "pending"));
  const pending = rows.filter((r) => r.status === "pending").length;
  return (
    <div className="space-y-4">
      <div className="flex gap-2" role="tablist">
        {(["pending", "reviewed"] as const).map((t) => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`btn btn-sm ${tab === t ? "btn-primary" : "btn-ghost"}`}>{t === "pending" ? `Waiting (${pending})` : "Reviewed"}</button>)}
      </div>
      {list.length === 0 && <div className="glass p-8 text-center text-sm text-white/65">{tab === "pending" ? "No requests are waiting." : "Nothing reviewed yet."}</div>}
      {list.map((r) => (
        <div key={r.id} className="glass space-y-3 p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div><p className="font-semibold">{r.name}</p><p className="text-sm text-white/70">{r.email}{r.phone ? ` · ${r.phone}` : ""}</p></div>
            <span className={`badge ${r.status === "approved" ? "badge-ok" : r.status === "rejected" ? "badge-bad" : "badge-warn"}`}>{r.status}</span>
          </div>
          <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            <div><dt className="inline text-white/65">Wants to be: </dt><dd className="inline font-medium">{ROLE[r.level]}</dd></div>
            <div><dt className="inline text-white/65">For: </dt><dd className="inline font-medium">{r.orgName}</dd></div>
            {r.zone && r.level !== "zone" && <div><dt className="inline text-white/65">Zone: </dt><dd className="inline">{r.zone}</dd></div>}
            {r.area && r.level === "parish" && <div><dt className="inline text-white/65">Area: </dt><dd className="inline">{r.area}</dd></div>}
          </dl>
          {r.status === "pending" && r.isNew && <p className="badge-warn rounded-xl p-2.5 text-xs">"{r.orgName}" is not in your structure yet. Approving will create it. Check the spelling first.</p>}
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
      ))}
    </div>
  );
}
