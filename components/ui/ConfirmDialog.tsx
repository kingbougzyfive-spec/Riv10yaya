"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

export type ConfirmOptions = { title: string; message?: ReactNode; confirmLabel?: string; cancelLabel?: string; tone?: "danger" | "default"; input?: { label: string; initial?: string; minLength?: number } };
type Ask = (o: ConfirmOptions) => Promise<boolean>;
type PromptFn = (o: ConfirmOptions) => Promise<string | null>;
const Ctx = createContext<{ ask: Ask; prompt: PromptFn } | null>(null);

/** Promise-based replacement for window.confirm(): `if (!(await confirm({ title: "Delete?" }))) return;` */
export function useConfirm(): Ask {
  const c = useContext(Ctx);
  if (!c) throw new Error("useConfirm must be used inside <ConfirmProvider>");
  return c.ask;
}
/** In-app replacement for window.prompt(): resolves to the trimmed text, or null if cancelled. */
export function useTextPrompt(): PromptFn {
  const c = useContext(Ctx);
  if (!c) throw new Error("useTextPrompt must be used inside <ConfirmProvider>");
  return c.prompt;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opt, setOpt] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);
  const [text, setText] = useState("");
  const textRef = useRef("");
  textRef.current = text;
  const box = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  const ask = useCallback<Ask>((o) => new Promise<boolean>((res) => {
    resolver.current?.(false);
    opener.current = document.activeElement as HTMLElement | null;
    resolver.current = res;
    setText(o.input?.initial ?? "");
    setOpt(o);
  }), []);
  const prompt = useCallback<PromptFn>(async (o) => {
    const ok = await ask({ tone: "default", confirmLabel: "Save", ...o, input: o.input ?? { label: "Answer" } });
    return ok ? textRef.current.trim() : null;
  }, [ask]);
  const close = useCallback((v: boolean) => {
    resolver.current?.(v); resolver.current = null; setOpt(null);
    opener.current?.focus?.();
  }, []);

  useEffect(() => {
    if (!opt) return;
    const el = box.current;
    // Start on the safe choice (Cancel) so Enter never confirms a destructive action by accident.
    if (!opt.input) el?.querySelector<HTMLElement>("[data-cancel]")?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); close(false); return; }
      if (e.key !== "Tab" || !el) return;
      const f = Array.from(el.querySelectorAll<HTMLElement>("button:not([disabled]), input"));
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", key);
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", key); document.body.style.overflow = prev; };
  }, [opt, close]);

  const danger = opt?.tone !== "default";
  return (
    <Ctx.Provider value={{ ask, prompt }}>
      {children}
      {opt && (
        <div className="fixed inset-0 z-[120] grid place-items-center bg-black/60 p-4" onMouseDown={(e) => e.target === e.currentTarget && close(false)}>
          <div ref={box} role="alertdialog" aria-modal="true" aria-labelledby="cf-title" aria-describedby="cf-msg" className="glass-strong w-full max-w-md rounded-2xl p-6">
            <div className="flex gap-3">
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${danger ? "bg-red-500/15 text-red-300" : "bg-brand/15 text-brand"}`}><AlertTriangle className="h-5 w-5" aria-hidden /></span>
              <div className="min-w-0">
                <h2 id="cf-title" className="text-base font-bold">{opt.title}</h2>
                <div id="cf-msg" className="mt-1 text-sm text-white/75">{opt.message ?? "This action is recorded in the audit log."}</div>
              </div>
            </div>
            {opt.input && (
              <div className="mt-4">
                <label htmlFor="cf-input" className="label">{opt.input.label}</label>
                <input id="cf-input" className="input" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && text.trim().length >= (opt.input?.minLength ?? 1)) close(true); }} autoFocus />
              </div>
            )}
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button data-cancel className="btn btn-ghost" onClick={() => close(false)}>{opt.cancelLabel ?? "Cancel"}</button>
              <button className={`btn ${danger ? "btn-danger" : "btn-primary"}`} disabled={!!opt.input && text.trim().length < (opt.input.minLength ?? 1)} onClick={() => close(true)}>{opt.confirmLabel ?? (danger ? "Yes, continue" : "Confirm")}</button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}
