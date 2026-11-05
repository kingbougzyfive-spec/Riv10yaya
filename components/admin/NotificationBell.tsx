"use client";
import { Bell } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/fetcher";

/** Unread count plus the latest notices. Refreshes on focus and every minute; no server push needed. */
export function NotificationBell({ className = "" }: { className?: string }) {
  const [d, setD] = useState<{ unread: number; rows: any[] } | null>(null);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const load = useCallback(() => { api("/api/notifications").then(setD).catch(() => {}); }, []);
  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    window.addEventListener("focus", load);
    return () => { clearInterval(t); window.removeEventListener("focus", load); };
  }, [load]);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const markAll = async () => { await api("/api/notifications", { method: "PATCH", json: { all: true } }).catch(() => {}); load(); };
  return (
    <div ref={box} className={`relative ${className}`}>
      <button type="button" className="btn btn-ghost btn-sm relative !p-2" aria-label={`Notifications${d?.unread ? `, ${d.unread} unread` : ""}`} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Bell className="h-4 w-4" />
        {!!d?.unread && <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-black text-[#1d1400]">{d.unread > 9 ? "9+" : d.unread}</span>}
      </button>
      {open && (
        <div className="glass-strong absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] p-2 shadow-2xl">
          <div className="flex items-center justify-between px-2 py-1.5"><p className="text-sm font-bold">Notifications</p>{!!d?.unread && <button className="text-xs text-brand hover:underline" onClick={markAll}>Mark all read</button>}</div>
          <div className="max-h-80 overflow-y-auto">
            {d?.rows.length === 0 && <p className="p-4 text-center text-sm text-white/50">Nothing yet.</p>}
            {d?.rows.map((n) => {
              const inner = (<><p className={`text-sm ${n.read ? "text-white/70" : "font-bold"}`}>{n.title}</p>{n.body && <p className="mt-0.5 line-clamp-3 text-xs text-white/55">{n.body}</p>}<p className="mt-1 text-[10px] text-white/35">{new Date(n.at).toLocaleString("en-NG")}</p></>);
              return n.link ? <Link key={n.id} href={n.link} onClick={() => setOpen(false)} className="block rounded-xl px-3 py-2 hover:bg-white/5">{inner}</Link> : <div key={n.id} className="rounded-xl px-3 py-2">{inner}</div>;
            })}
          </div>
        </div>
      )}
    </div>
  );
}
