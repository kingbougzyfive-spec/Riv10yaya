"use client";
import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

/** When a new version of the app is waiting, offer it. It is never applied automatically, so a half-filled form isn't lost. */
export function UpdateToast() {
  const [reg, setReg] = useState<ServiceWorkerRegistration | null>(null);
  useEffect(() => {
    const on = (e: Event) => setReg((e as CustomEvent<ServiceWorkerRegistration>).detail);
    window.addEventListener("sw-update-ready", on);
    return () => window.removeEventListener("sw-update-ready", on);
  }, []);
  if (!reg) return null;
  return (
    <div className="fixed inset-x-0 bottom-20 z-[120] flex justify-center px-4 sm:bottom-6">
      <div className="glass flex items-center gap-3 px-4 py-3 text-sm">
        <RefreshCw className="h-4 w-4 text-brand" />
        <span>A new version is ready.</span>
        <button className="btn btn-primary btn-sm" onClick={() => { navigator.serviceWorker.addEventListener("controllerchange", () => location.reload(), { once: true }); reg.waiting?.postMessage({ type: "SKIP_WAITING" }); }}>Update</button>
        <button className="btn btn-ghost btn-sm" onClick={() => setReg(null)}>Later</button>
      </div>
    </div>
  );
}
