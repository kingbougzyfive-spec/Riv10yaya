import { useId, type ReactElement, type ReactNode, cloneElement } from "react";

/** Label + control + hint + error, wired together with ids for screen readers. */
export function Field({ label, hint, error, required, children }: { label: string; hint?: string; error?: string; required?: boolean; children: ReactElement<Record<string, unknown>> }) {
  const id = useId();
  const described = [hint ? `${id}-h` : "", error ? `${id}-e` : ""].filter(Boolean).join(" ") || undefined;
  return (
    <div>
      <label htmlFor={id} className="label">{label}{required && <span className="text-red-300" aria-hidden> *</span>}</label>
      {cloneElement(children, { id, "aria-describedby": described, "aria-invalid": error ? true : undefined, required: required || undefined })}
      {hint && !error && <p id={`${id}-h`} className="hint">{hint}</p>}
      {error && <p id={`${id}-e`} role="alert" className="field-error">{error}</p>}
    </div>
  );
}

export function IntegrationNotice({ name, configured, needs, children }: { name: string; configured: boolean; needs?: string[]; children?: ReactNode }) {
  if (configured) return null;
  return (
    <div role="note" className="rounded-xl border border-amber-400/30 bg-amber-400/5 px-4 py-3 text-sm">
      <p className="font-semibold">{name} is not configured</p>
      <p className="mt-0.5 text-xs text-white/75">{children ?? "This feature is unavailable until it is set up."}{needs?.length ? <> Missing: <code className="text-[11px]">{needs.join(", ")}</code>.</> : null}</p>
    </div>
  );
}
