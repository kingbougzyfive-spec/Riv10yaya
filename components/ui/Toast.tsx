"use client";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, XCircle, X } from "lucide-react";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type T = { id: number; kind: "ok" | "err"; msg: string };
const Ctx = createContext<{ ok: (m: string) => void; err: (m: string) => void }>({ ok() {}, err() {} });
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<T[]>([]);
  const push = useCallback((kind: T["kind"], msg: string) => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s, { id, kind, msg }]);
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), kind === "err" ? 6500 : 3500);
  }, []);
  return (
    <Ctx.Provider value={{ ok: (m) => push("ok", m), err: (m) => push("err", m) }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4 sm:items-end sm:pr-6">
        <AnimatePresence>
          {items.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 24, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40 }}
              className="glass-strong pointer-events-auto flex max-w-sm items-start gap-3 rounded-2xl px-4 py-3 text-sm shadow-2xl"
            >
              {t.kind === "ok" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />}
              <span className="flex-1">{t.msg}</span>
              <button onClick={() => setItems((s) => s.filter((x) => x.id !== t.id))} aria-label="Dismiss"><X className="h-4 w-4 text-white/40 hover:text-white" /></button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}
