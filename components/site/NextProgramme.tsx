"use client";
import { ArrowRight, CalendarDays } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export type NextEvent = { id: string; title: string; startsAt: string; registrationOpen: boolean } | null;
const pad = (n: number) => String(n).padStart(2, "0");

/** The next published event with a live countdown. Renders nothing when there is none. */
export function NextProgramme({ event }: { event: NextEvent }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  if (!event) return null;
  const start = new Date(event.startsAt);
  const left = now === null ? null : start.getTime() - now;
  const s = left === null ? 0 : Math.max(0, Math.floor(left / 1000));
  const day = start.toLocaleDateString("en-NG", { day: "numeric", month: "short", timeZone: "Africa/Lagos" });
  return (
    <section className="mx-auto max-w-6xl px-4 pt-2 sm:px-6">
      <div className="glass flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5">
        <div className="flex min-w-0 flex-1 basis-72 items-center gap-4">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-accent text-center text-[#1d1400]"><CalendarDays className="mx-auto h-4 w-4" /><span className="text-[11px] font-black leading-none">{day.toUpperCase()}</span></div>
          <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-widest text-accent">Next programme</p><p className="truncate text-lg font-black">{event.title}</p></div>
        </div>
        {left !== null && left > 0 && (
          <div className="flex gap-2" aria-label="Time until the event starts">
            {[["days", Math.floor(s / 86400)], ["hrs", pad(Math.floor((s % 86400) / 3600))], ["min", pad(Math.floor((s % 3600) / 60))], ["sec", pad(s % 60)]].map(([l, v]) => (
              <div key={l as string} className="min-w-[3.4rem] rounded-xl border border-white/10 bg-white/5 px-2 py-1.5 text-center"><p className="text-xl font-black tabular-nums">{v}</p><p className="text-[10px] uppercase tracking-widest text-white/50">{l}</p></div>
            ))}
          </div>
        )}
        {left !== null && left <= 0 && <span className="badge badge-ok">Happening now</span>}
        <Link href={`/events/${event.id}`} className="btn btn-primary">{event.registrationOpen ? "Register now" : "View details"}<ArrowRight className="h-4 w-4" /></Link>
      </div>
    </section>
  );
}
