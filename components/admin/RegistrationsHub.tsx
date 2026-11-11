"use client";
import { useEffect, useState } from "react";
import { RegistrationsView } from "@/components/admin/RegistrationsView";
import { api } from "@/lib/fetcher";

/** Pick an event, then see its registrations (search, filter by zone/area/parish, check in, export). */
export function RegistrationsHub({ canCheckIn }: { canCheckIn: boolean }) {
  const [events, setEvents] = useState<any[] | null>(null);
  const [id, setId] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => { api("/api/events").then((r) => { setEvents(r.events); setId(r.events.find((e: any) => e.status === "published")?.id ?? r.events[0]?.id ?? ""); }).catch((e) => setErr(e.message)); }, []);
  if (err) return <p className="text-red-300">{err}</p>;
  if (!events) return <div className="skeleton h-40" />;
  if (!events.length) return <p className="glass p-8 text-center text-white/65">No events yet. Create one under Events first.</p>;
  return (
    <div className="space-y-5">
      <div className="glass max-w-xl p-4"><label className="label">Event</label>
        <select className="input" value={id} onChange={(e) => setId(e.target.value)}>
          {events.map((e) => <option key={e.id} value={e.id}>{e.title} · {new Date(e.startsAt).toLocaleDateString("en-NG", { dateStyle: "medium" })} · {e.registered} registered</option>)}
        </select>
      </div>
      {id && <RegistrationsView key={id} eventId={id} canCheckIn={canCheckIn} />}
    </div>
  );
}
