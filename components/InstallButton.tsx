"use client";
import { CheckCircle2, Download, MonitorSmartphone, MoreVertical, PlusSquare, Share, Smartphone, Tablet } from "lucide-react";
import { useEffect, useState } from "react";

type Platform = "iphone" | "ipad" | "android" | "desktop";

export function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/iphone|ipod/i.test(ua)) return "iphone";
  // iPadOS 13+ reports itself as a Mac; touch points tell them apart.
  if (/ipad/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return "ipad";
  if (/android/i.test(ua)) return "android";
  return "desktop";
}

function Card({ icon, title, active, children }: { icon: React.ReactNode; title: string; active: boolean; children: React.ReactNode }) {
  return (
    <div className={`glass p-5 ${active ? "ring-1 ring-brand/60" : ""}`}>
      <p className="flex items-center gap-2 font-bold">{icon}{title}{active && <span className="ml-auto rounded-full bg-brand/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand">Your device</span>}</p>
      <div className="mt-3 text-sm text-white/65">{children}</div>
    </div>
  );
}

export function InstallPanel() {
  const [evt, setEvt] = useState<any>(null);
  const [installed, setInstalled] = useState(false);
  const [plat, setPlat] = useState<Platform | null>(null);
  useEffect(() => {
    setPlat(detectPlatform());
    if (window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone) setInstalled(true);
    const h = (e: Event) => { e.preventDefault(); setEvt(e); };
    const done = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", h);
    window.addEventListener("appinstalled", done);
    return () => { window.removeEventListener("beforeinstallprompt", h); window.removeEventListener("appinstalled", done); };
  }, []);

  if (installed) return <p className="flex items-center gap-2 text-emerald-300"><CheckCircle2 className="h-5 w-5" />The app is installed on this device.</p>;
  const step = "flex flex-wrap items-center gap-1.5";
  return (
    <div className="space-y-5">
      {evt && (
        <button className="btn btn-primary px-6 py-3" onClick={async () => { evt.prompt(); await evt.userChoice; setEvt(null); }}>
          <Download className="h-4 w-4" />Install now
        </button>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card icon={<Smartphone className="h-4 w-4" />} title="iPhone (Safari)" active={plat === "iphone"}>
          <ol className="list-decimal space-y-1.5 pl-5">
            <li>Open this site in <b>Safari</b>.</li>
            <li className={step}>Tap the <Share className="h-4 w-4" /> <b>Share</b> button.</li>
            <li className={step}>Scroll down and tap <PlusSquare className="h-4 w-4" /> <b>Add to Home Screen</b>.</li>
            <li>Tap <b>Add</b>. Open the app from its new icon.</li>
          </ol>
        </Card>
        <Card icon={<Tablet className="h-4 w-4" />} title="iPad (Safari)" active={plat === "ipad"}>
          <ol className="list-decimal space-y-1.5 pl-5">
            <li>Open this site in <b>Safari</b>.</li>
            <li className={step}>Tap <Share className="h-4 w-4" /> <b>Share</b> (top of the screen).</li>
            <li className={step}>Tap <PlusSquare className="h-4 w-4" /> <b>Add to Home Screen</b>, then <b>Add</b>.</li>
          </ol>
        </Card>
        <Card icon={<Smartphone className="h-4 w-4" />} title="Android (Chrome)" active={plat === "android"}>
          <ol className="list-decimal space-y-1.5 pl-5">
            <li>Tap <b>Install now</b> above if you see it, or</li>
            <li className={step}>tap the <MoreVertical className="h-4 w-4" /> menu, then <b>Install app</b> (or <b>Add to Home screen</b>).</li>
          </ol>
          <p className="mt-2 text-xs text-white/45">Samsung Internet: menu, then Add page to, then Home screen.</p>
        </Card>
        <Card icon={<MonitorSmartphone className="h-4 w-4" />} title="Computer (Chrome / Edge)" active={plat === "desktop"}>
          <p>Click the install icon at the right of the address bar, or open the browser menu and choose <b>Install</b>.</p>
          <p className="mt-2 text-xs text-white/45">Firefox on a computer can't install web apps. Use Chrome or Edge, or just keep the site bookmarked.</p>
        </Card>
      </div>
      <p className="text-xs text-white/45">Installing is optional. The website works in any browser. Once installed, public pages you have already opened can be read offline, but payments, reports and approvals always need an internet connection.</p>
    </div>
  );
}
