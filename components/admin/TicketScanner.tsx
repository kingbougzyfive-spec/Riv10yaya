"use client";
import { CheckCircle2, Loader2, ScanLine, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { api } from "@/lib/fetcher";
import { cn } from "@/lib/cn";

type Result = { ok: boolean; msg: string; name?: string };

/** Scans QR tickets with the phone camera and checks the person in. Uses the browser's BarcodeDetector when present, jsQR otherwise. */
export function TicketScanner({ eventId, onChecked }: { eventId: string; onChecked: () => void }) {
  const [open, setOpen] = useState(false);
  return (<>
    <button className="btn btn-primary" onClick={() => setOpen(true)}><ScanLine className="h-4 w-4" />Scan tickets</button>
    {open && <Scanner eventId={eventId} onClose={() => { setOpen(false); onChecked(); }} onChecked={onChecked} />}
  </>);
}

function Scanner({ eventId, onClose, onChecked }: { eventId: string; onClose: () => void; onChecked: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<Result | null>(null);
  const [manual, setManual] = useState("");
  const last = useRef({ code: "", at: 0 });

  async function submit(code: string) {
    if (busy) return;
    setBusy(true);
    try {
      const r = await api("/api/registrations/checkin", { method: "POST", json: { code, eventId } });
      setRes({ ok: true, name: r.name, msg: r.already ? "Already checked in earlier" : "Checked in" });
      if (!r.already) onChecked();
    } catch (e: any) { setRes({ ok: false, msg: e.message }); }
    setBusy(false);
    setTimeout(() => setRes(null), 3500);
  }

  useEffect(() => {
    let stream: MediaStream | undefined, raf = 0, stopped = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (!video.current) return;
        video.current.srcObject = stream;
        await video.current.play();
        const Detector = (window as any).BarcodeDetector;
        const det = Detector ? new Detector({ formats: ["qr_code"] }) : null;
        const jsQR = det ? null : (await import("jsqr")).default;
        const tick = async () => {
          if (stopped) return;
          const v = video.current!;
          if (v.readyState >= 2) {
            let code = "";
            if (det) { const f = await det.detect(v).catch(() => []); code = f[0]?.rawValue ?? ""; }
            else if (jsQR && canvas.current) {
              const c = canvas.current, w = (c.width = v.videoWidth), h = (c.height = v.videoHeight), ctx = c.getContext("2d", { willReadFrequently: true })!;
              ctx.drawImage(v, 0, 0, w, h);
              code = jsQR(ctx.getImageData(0, 0, w, h).data, w, h)?.data ?? "";
            }
            const now = Date.now();
            if (code && (code !== last.current.code || now - last.current.at > 5000)) { last.current = { code, at: now }; submit(code); }
          }
          raf = window.setTimeout(tick, 250);
        };
        tick();
      } catch { setErr("Camera unavailable. Allow camera access, or type the reference below."); }
    })();
    return () => { stopped = true; clearTimeout(raf); stream?.getTracks().forEach((t) => t.stop()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Modal open onClose={onClose} title="Scan tickets">
      <div className="space-y-4">
        <div className="relative aspect-square overflow-hidden rounded-2xl bg-black">
          <video ref={video} playsInline muted className="h-full w-full object-cover" />
          <canvas ref={canvas} hidden />
          <div className="pointer-events-none absolute inset-8 rounded-2xl border-2 border-brand/80" />
          {busy && <div className="absolute inset-0 grid place-items-center bg-black/40"><Loader2 className="h-8 w-8 animate-spin" /></div>}
          {res && <div className={cn("absolute inset-x-3 bottom-3 flex items-center gap-3 rounded-xl p-3 text-sm font-semibold backdrop-blur", res.ok ? "bg-emerald-500/85 text-black" : "bg-red-500/85 text-white")}>{res.ok ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}<span>{res.name ? `${res.name} · ` : ""}{res.msg}</span></div>}
        </div>
        {err && <p className="badge-warn rounded-xl p-3 text-xs">{err}</p>}
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (manual.trim()) { submit(manual.trim()); setManual(""); } }}>
          <input className="input" placeholder="Or type reference e.g. YAYA-ABC-1234" value={manual} onChange={(e) => setManual(e.target.value)} />
          <button className="btn btn-ghost">Check in</button>
        </form>
      </div>
    </Modal>
  );
}
