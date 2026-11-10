"use client";
import { AnimatePresence, motion } from "framer-motion";
import { CloudOff, Wifi } from "lucide-react";
import { useEffect, useState } from "react";
import { useOnline } from "@/lib/online";
import { flushOutbox, pendingCount } from "@/lib/outbox";

/** Always tells the truth about connectivity. While offline, writes are blocked (see lib/fetcher), the page is
 *  marked `data-offline` so financial buttons can dim themselves, and queued items are reported as "not sent yet". */
export function OfflineBanner() {
  const online = useOnline();
  const [queued, setQueued] = useState(0);
  const [back, setBack] = useState(false);

  useEffect(() => { document.documentElement.dataset.offline = online ? "0" : "1"; }, [online]);
  useEffect(() => {
    const refresh = () => pendingCount().then(setQueued);
    refresh();
    window.addEventListener("outbox-change", refresh);
    return () => window.removeEventListener("outbox-change", refresh);
  }, []);
  useEffect(() => {
    if (!online) return;
    flushOutbox();
    const vis = () => { if (document.visibilityState === "visible") flushOutbox(); };
    document.addEventListener("visibilitychange", vis);
    return () => document.removeEventListener("visibilitychange", vis);
  }, [online]);
  useEffect(() => {
    if (online) return;
    setBack(false);
    return () => { setBack(true); const t = setTimeout(() => setBack(false), 2500); return () => clearTimeout(t); };
  }, [online]);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[150] flex justify-center px-3 pt-[max(0.5rem,env(safe-area-inset-top))]" aria-live="polite">
      <AnimatePresence>
        {!online && (
          <motion.div key="off" initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -40, opacity: 0 }} role="status"
            className="pointer-events-auto flex max-w-md items-start gap-2.5 rounded-2xl border border-amber-400/40 bg-amber-500/15 px-4 py-2.5 text-sm text-amber-100 shadow-xl backdrop-blur-xl">
            <CloudOff className="mt-0.5 h-4 w-4 shrink-0" />
            <span><b>You're offline.</b> Public pages you opened before can still be read. Payments, reports and approvals need a connection and cannot be sent right now.{queued > 0 && <> {queued} small update{queued > 1 ? "s are" : " is"} not sent yet.</>}</span>
          </motion.div>
        )}
        {online && back && (
          <motion.div key="on" initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -40, opacity: 0 }} role="status"
            className="pointer-events-auto flex items-center gap-2 rounded-2xl border border-emerald-400/40 bg-emerald-500/15 px-4 py-2 text-sm text-emerald-100 backdrop-blur-xl">
            <Wifi className="h-4 w-4" />Back online.
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
