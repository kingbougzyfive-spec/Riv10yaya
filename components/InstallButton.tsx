"use client";
import { Download, Share, PlusSquare, CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";

export function InstallPanel() {
  const [evt, setEvt] = useState<any>(null);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);
  useEffect(() => {
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    if (window.matchMedia("(display-mode: standalone)").matches) setInstalled(true);
    const h = (e: Event) => { e.preventDefault(); setEvt(e); };
    window.addEventListener("beforeinstallprompt", h);
    window.addEventListener("appinstalled", () => setInstalled(true));
    return () => window.removeEventListener("beforeinstallprompt", h);
  }, []);
  if (installed) return <p className="flex items-center gap-2 text-emerald-300"><CheckCircle2 className="h-5 w-5" />The app is installed on this device.</p>;
  return (
    <div className="space-y-5">
      {evt && (
        <button className="btn btn-primary px-6 py-3" onClick={async () => { evt.prompt(); await evt.userChoice; setEvt(null); }}>
          <Download className="h-4 w-4" />Install now
        </button>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="glass p-5">
          <p className="font-bold">Android (Chrome)</p>
          <p className="mt-2 text-sm text-white/60">Tap the <b>⋮</b> menu, then <b>Install app</b> or <b>Add to Home screen</b>.</p>
        </div>
        <div className={`glass p-5 ${ios ? "ring-1 ring-brand/50" : ""}`}>
          <p className="font-bold">iPhone / iPad (Safari)</p>
          <p className="mt-2 flex flex-wrap items-center gap-1.5 text-sm text-white/60">Tap <Share className="h-4 w-4" /> Share, then <PlusSquare className="h-4 w-4" /> <b>Add to Home Screen</b>.</p>
        </div>
      </div>
    </div>
  );
}
