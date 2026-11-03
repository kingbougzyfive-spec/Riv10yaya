"use client";
import { Loader2, Plus, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/fetcher";
import { ROLES, ROLE_LABELS, type Role } from "@/lib/roles";

type U = { id: string; name: string; email: string; phone?: string; role: Role; active: boolean; zone: string; area: string; parish: string; scopeLabel: string; lastLoginAt?: string };
type Org = { zones: { id: string; name: string; hasAreas: boolean }[]; areas: { id: string; name: string; zone: string }[]; parishes: { id: string; name: string; zone: string; area: string | null }[] };

export function UsersManager({ meId }: { meId: string }) {
  const toast = useToast();
  const [users, setUsers] = useState<U[] | null>(null);
  const [org, setOrg] = useState<Org | null>(null);
  const [dlg, setDlg] = useState<{ edit?: U } | null>(null);
  const load = useCallback(() => api("/api/users").then((r) => setUsers(r.users)).catch((e) => toast.err(e.message)), [toast]);
  useEffect(() => { load(); api("/api/org").then(setOrg).catch(() => {}); }, [load]);

  return (
    <>
      <div className="mb-5 flex justify-end"><button className="btn btn-primary" onClick={() => setDlg({})}><Plus className="h-4 w-4" />Add user</button></div>
      <div className="grid gap-3">
        {users === null && [0, 1, 2].map((i) => <div key={i} className="skeleton h-20" />)}
        {users?.map((u, i) => (
          <motion.button key={u.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.4) }} onClick={() => setDlg({ edit: u })} className="glass glass-hover flex items-center justify-between gap-4 p-4 text-left">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand/20 font-black text-brand">{u.name.slice(0, 1).toUpperCase()}</div>
              <div className="min-w-0"><p className="truncate font-semibold">{u.name}{u.id === meId && <span className="ml-2 text-xs text-white/40">(you)</span>}</p><p className="truncate text-xs text-white/45">{u.email}{u.scopeLabel ? ` · ${u.scopeLabel}` : ""}</p></div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1"><span className="badge">{ROLE_LABELS[u.role]}</span><span className={`badge ${u.active ? "badge-ok" : "badge-bad"}`}>{u.active ? "Active" : "Disabled"}</span></div>
          </motion.button>
        ))}
      </div>
      {dlg && org && <UserDialog key={dlg.edit?.id ?? "new"} edit={dlg.edit} org={org} meId={meId} onClose={() => setDlg(null)} onDone={load} />}
    </>
  );
}

function UserDialog({ edit, org, meId, onClose, onDone }: { edit?: U; org: Org; meId: string; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ name: edit?.name ?? "", email: edit?.email ?? "", phone: edit?.phone ?? "", role: (edit?.role ?? "parish_admin") as Role, zone: edit?.zone ?? "", area: edit?.area ?? "", parish: edit?.parish ?? "", password: "", active: edit?.active ?? true });
  const [busy, setBusy] = useState(false);
  const needsZone = f.role === "zonal_admin";
  const needsArea = f.role === "area_admin";
  const needsParish = f.role === "parish_admin";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (edit) {
        await api("/api/users", { method: "PATCH", json: { id: edit.id, name: f.name, phone: f.phone, role: f.role, zone: needsZone ? f.zone : "", area: needsArea ? f.area : "", parish: needsParish ? f.parish : "", active: f.active, ...(f.password ? { password: f.password } : {}) } });
      } else {
        await api("/api/users", { method: "POST", json: { name: f.name, email: f.email, phone: f.phone, role: f.role, zone: needsZone ? f.zone : "", area: needsArea ? f.area : "", parish: needsParish ? f.parish : "", password: f.password } });
      }
      toast.ok(edit ? "User updated" : "User created"); onClose(); onDone();
    } catch (e: any) { toast.err(e.message); }
    setBusy(false);
  }

  return (
    <Modal open onClose={onClose} title={edit ? "Edit user" : "Add user"}>
      <form onSubmit={submit} className="space-y-4">
        <div><label className="label">Full name</label><input className="input" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div><label className="label">Email</label><input className="input" type="email" required disabled={!!edit} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
        <div><label className="label">Phone (optional)</label><input className="input" inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="0803 000 0000" /></div>
        <div><label className="label">Role</label><select className="input" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })}>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select></div>
        {needsZone && <div><label className="label">Zone they manage</label><select className="input" required value={f.zone} onChange={(e) => setF({ ...f, zone: e.target.value })}><option value="">Select…</option>{org.zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}</select></div>}
        {needsArea && <div><label className="label">Area they manage</label><select className="input" required value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })}><option value="">Select…</option>{org.areas.map((a) => <option key={a.id} value={a.id}>{org.zones.find((z) => z.id === a.zone)?.name} → {a.name}</option>)}</select></div>}
        {needsParish && <div><label className="label">Parish they manage</label><select className="input" required value={f.parish} onChange={(e) => setF({ ...f, parish: e.target.value })}><option value="">Select…</option>{org.parishes.map((p) => <option key={p.id} value={p.id}>{org.zones.find((z) => z.id === p.zone)?.name} → {p.area ? org.areas.find((a) => a.id === p.area)?.name + " → " : ""}{p.name}</option>)}</select></div>}
        <div><label className="label">{edit ? "New password (leave blank to keep)" : "Password"}</label><input className="input" type="password" minLength={10} required={!edit} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /><p className="hint">At least 10 characters.</p></div>
        {edit && edit.id !== meId && (
          <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-white/5 p-3 text-sm"><input type="checkbox" className="h-4 w-4 accent-emerald-500" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />Account is active (untick to block sign-in)</label>
        )}
        <button className="btn btn-primary w-full py-3" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}{edit ? "Save changes" : "Create user"}</button>
      </form>
    </Modal>
  );
}
