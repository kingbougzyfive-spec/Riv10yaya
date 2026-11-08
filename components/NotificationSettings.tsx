"use client";
import { Bell, Lock } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { PushToggle } from "@/components/PushToggle";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/fetcher";
import { CATEGORIES, type Category } from "@/lib/notify-events";

/** Every person's own notification choices. Push permission is only asked for when they press the button. */
export function NotificationSettings() {
  const toast = useToast();
  const [d, setD] = useState<any>(null);
  const load = useCallback(() => api("/api/me/prefs").then(setD).catch((e) => toast.err(e.message)), [toast]);
  useEffect(() => { load(); }, [load]);
  if (!d) return <div className="skeleton h-40" />;
  const save = async (patch: any) => { setD({ ...d, prefs: { ...d.prefs, ...patch } }); try { await api("/api/me/prefs", { method: "PATCH", json: patch }); } catch (e: any) { toast.err(e.message); load(); } };
  const toggleMute = (c: string, on: boolean) => save({ mute: on ? d.prefs.mute.filter((m: string) => m !== c) : [...d.prefs.mute, c] });
  return (
    <div className="glass space-y-5 p-5">
      <div><p className="flex items-center gap-2 font-bold"><Bell className="h-4 w-4 text-accent" />Notification settings</p><p className="mt-1 text-xs text-white/55">You always get a notice inside the app. Choose what else reaches you.</p></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex items-start gap-3 rounded-xl bg-white/5 p-3 text-sm"><input type="checkbox" className="mt-1" checked={d.prefs.email} onChange={(e) => save({ email: e.target.checked })} /><span><b>Email</b><span className="block text-xs text-white/50">{d.emailAvailable ? "Sent to the address on your account." : "Email isn't set up on this site yet."}</span></span></label>
        <label className="flex items-start gap-3 rounded-xl bg-white/5 p-3 text-sm"><input type="checkbox" className="mt-1" checked={d.prefs.push} onChange={(e) => save({ push: e.target.checked })} /><span><b>Push notifications</b><span className="block text-xs text-white/50">{d.pushAvailable ? `${d.devices} device${d.devices === 1 ? "" : "s"} connected.` : "Push isn't set up on this site yet."}</span></span></label>
      </div>
      {d.pushAvailable && d.prefs.push && (
        <div className="rounded-xl border border-white/10 p-3"><p className="mb-2 text-sm text-white/70">To get push alerts on this device, turn them on here. Your browser will then ask for permission.</p><PushToggle />{d.devices > 0 && <button className="btn btn-ghost btn-sm mt-3" onClick={async () => { await api("/api/me/prefs", { method: "DELETE" }); toast.ok("Push turned off on all your devices"); load(); }}>Turn off on all my devices</button>}</div>
      )}
      <div>
        <p className="mb-2 text-sm font-semibold">What you hear about</p>
        <ul className="space-y-1.5">{(Object.keys(CATEGORIES) as Category[]).map((c) => { const k = CATEGORIES[c]; const on = k.locked || !d.prefs.mute.includes(c); return (
          <li key={c} className="flex items-start justify-between gap-3 rounded-xl bg-white/5 px-3 py-2.5 text-sm"><span><b>{k.label}</b><span className="block text-xs text-white/50">{k.help}</span></span>{k.locked ? <span className="flex shrink-0 items-center gap-1 text-xs text-white/50"><Lock className="h-3 w-3" />Always on</span> : <label className="flex shrink-0 items-center gap-2 text-xs"><input type="checkbox" checked={on} onChange={(e) => toggleMute(c, e.target.checked)} />Email &amp; push</label>}</li>); })}</ul>
      </div>
    </div>
  );
}
