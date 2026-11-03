"use client";
import { useEffect, useState } from "react";
import { QrCode } from "@/components/Qr";
import { api } from "@/lib/fetcher";

export function PrintSheet({ id, layout, brand }: { id: string; layout: string; brand: string }) {
  const [d, setD] = useState<any>(null);
  const [origin, setOrigin] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => { setOrigin(window.location.origin); api(`/api/attendance/sessions/${id}`).then(setD).catch((e) => setErr(e.message)); }, [id]);
  if (err) return <p className="p-10">{err}</p>;
  if (!d || !origin) return <p className="p-10">Loading…</p>;
  const url = `${origin}/attend/${d.session.token}`;
  const where = [d.session.zone, d.session.area, d.session.parish].filter(Boolean).join(" → ");
  return (
    <div className="min-h-screen bg-[#fff] text-[#0b1220]">
      <style>{`@media print{.aurora{display:none!important}.noprint{display:none!important}body{background:#fff!important}@page{margin:10mm}}body{background:#fff!important}`}</style>
      <div className="noprint sticky top-0 flex items-center justify-between gap-3 bg-[#0b1220] px-5 py-3 text-white"><span className="text-sm">Use <b>Print</b>, then choose “Save as PDF” to get a PDF.</span><button className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-black" onClick={() => window.print()}>Print / Save PDF</button></div>
      {layout === "stickers" ? (
        <div className="grid grid-cols-3 gap-4 p-6">{Array.from({ length: 12 }).map((_, i) => <div key={i} className="flex break-inside-avoid flex-col items-center rounded-xl border-2 border-dashed border-gray-300 p-3 text-center"><QrCode value={url} size={150} className="!p-0" /><p className="mt-2 text-xs font-bold leading-tight">{d.session.title}</p><p className="text-[10px] text-gray-500">Scan to mark attendance</p></div>)}</div>
      ) : (
        <div className="mx-auto flex max-w-3xl flex-col items-center px-8 py-12 text-center">
          <p className="text-sm font-bold uppercase tracking-[.3em] text-gray-500">{brand}</p>
          <h1 className="mt-6 text-5xl font-black leading-tight">{d.session.title}</h1>
          {where && <p className="mt-2 text-lg text-gray-500">{where}</p>}
          <div className="my-10 rounded-3xl border-4 border-[#0b1220] p-5"><QrCode value={url} size={420} className="!p-0" /></div>
          <p className="text-3xl font-black">Scan to mark your attendance</p>
          <p className="mt-3 max-w-md text-gray-600">Point your phone camera at the code. Members use their member ID or phone number; visitors can sign in with their name and phone.</p>
          <p className="mt-6 text-xs text-gray-400">{new Date(d.session.opensAt).toLocaleString("en-NG", { dateStyle: "full", timeStyle: "short" })}</p>
        </div>
      )}
    </div>
  );
}
