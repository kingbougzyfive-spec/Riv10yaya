"use client";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";

const b64 = (s: string) => { const p = "=".repeat((4 - (s.length % 4)) % 4); const r = atob((s + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(r, (c) => c.charCodeAt(0)); };

/** Opt-in notifications. Hidden when the site hasn't been given VAPID keys or the browser can't do push. */
export function PushToggle() {
  const toast = useToast();
  const [state, setState] = useState<"hidden" | "off" | "on" | "blocked" | "ios-install">("hidden");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const apple = /iphone|ipad|ipod/i.test(navigator.userAgent) || (/Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
        const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;
        // iPhone/iPad only expose Web Push to an installed home-screen app (iOS/iPadOS 16.4+).
        if (apple && !standalone) { setState("ios-install"); return; }
        if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return;
        const cfg = await fetch("/api/public/push").then((r) => r.json());
        if (!cfg.enabled) return;
        if (Notification.permission === "denied") return setState("blocked");
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = reg ? await reg.pushManager.getSubscription() : null;
        setState(sub ? "on" : "off");
      } catch {}
    })();
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const cfg = await fetch("/api/public/push").then((r) => r.json());
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setState(perm === "denied" ? "blocked" : "off"); return; }
      const reg = (await navigator.serviceWorker.getRegistration()) || (await navigator.serviceWorker.register("/sw.js"));
      await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(cfg.key) }));
      const res = await fetch("/api/public/push", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Could not turn on notifications.");
      setState("on"); toast.ok("Notifications are on");
    } catch (e: any) { toast.err(e.message || "Could not turn on notifications."); }
    setBusy(false);
  }
  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) { await fetch("/api/public/push", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) }); await sub.unsubscribe(); }
      setState("off"); toast.ok("Notifications are off");
    } catch { toast.err("Could not turn off notifications."); }
    setBusy(false);
  }

  if (state === "hidden") return null;
  if (state === "ios-install") return <p className="max-w-md text-sm text-white/55">On iPhone and iPad, notifications work only after you add the app to your Home Screen (Safari, Share, Add to Home Screen) on iOS or iPadOS 16.4 or later. Open it from the Home Screen icon, then come back here and tap Turn on notifications. Delivery depends on your device and Apple's rules, and is not identical to Android or a computer.</p>;
  if (state === "blocked") return <p className="flex items-center gap-2 text-sm text-white/55"><BellOff className="h-4 w-4" />Notifications are blocked in your browser settings for this site.</p>;
  return state === "on"
    ? <button className="btn btn-ghost" disabled={busy} onClick={disable}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellOff className="h-4 w-4" />}Turn off notifications</button>
    : <button className="btn btn-primary" disabled={busy} onClick={enable}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}Turn on notifications</button>;
}
