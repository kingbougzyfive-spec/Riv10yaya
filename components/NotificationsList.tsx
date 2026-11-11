"use client";
import { Bell, CheckCheck } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/fetcher";

/** Your own notifications, newest first. */
export function NotificationsList() {
  const toast = useToast();
  const [d, setD] = useState<any>(null);
  const load = useCallback(() => api("/api/notifications").then(setD).catch((e) => toast.err(e.message)), [toast]);
  useEffect(() => { load(); }, [load]);
  const markAll = async () => { try { await api("/api/notifications", { method: "PATCH", json: { all: true } }); load(); } catch (e: any) { toast.err(e.message); } };
  if (!d) return <div className="skeleton h-48" />;
  return (
    <div className="glass p-5">
      <div className="mb-3 flex items-center justify-between"><p className="flex items-center gap-2 font-bold"><Bell className="h-4 w-4 text-accent" />Notifications{d.unread > 0 && <span className="badge">{d.unread} new</span>}</p>{d.unread > 0 && <button className="btn btn-ghost btn-sm" onClick={markAll}><CheckCheck className="h-4 w-4" />Mark all read</button>}</div>
      {d.rows.length === 0 ? <p className="py-8 text-center text-sm text-white/65">Nothing yet.</p> : (
        <ul className="space-y-2">{d.rows.map((n: any) => (
          <li key={n.id}><Link href={n.link || "#"} className={`block rounded-xl px-4 py-3 text-sm ${n.read ? "bg-white/5" : "bg-brand/10"}`}><b className="block">{n.title}</b>{n.body && <span className="block text-white/65">{n.body}</span>}<span className="mt-1 block text-[11px] text-white/65">{new Date(n.at).toLocaleString("en-NG")}</span></Link></li>
        ))}</ul>
      )}
    </div>
  );
}
