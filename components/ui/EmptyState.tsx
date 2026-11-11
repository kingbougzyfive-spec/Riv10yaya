import { AlertCircle, Inbox } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({ title, hint, action, icon }: { title: string; hint?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="grid place-items-center gap-2 rounded-2xl border border-dashed border-white/20 px-6 py-10 text-center">
      <span className="text-white/65" aria-hidden>{icon ?? <Inbox className="h-7 w-7" />}</span>
      <p className="text-sm font-semibold">{title}</p>
      {hint && <p className="max-w-sm text-xs text-white/65">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="grid place-items-center gap-2 rounded-2xl border border-red-500/30 bg-red-500/5 px-6 py-8 text-center">
      <AlertCircle className="h-6 w-6 text-red-300" aria-hidden />
      <p className="text-sm font-semibold">Something went wrong</p>
      <p className="max-w-sm text-xs text-white/75">{message || "The data could not be loaded."}</p>
      {onRetry && <button className="btn btn-ghost btn-sm mt-1" onClick={onRetry}>Try again</button>}
    </div>
  );
}

export function LoadingRows({ rows = 5 }: { rows?: number }) {
  return <div role="status" aria-label="Loading" className="space-y-2">{Array.from({ length: rows }, (_, i) => <div key={i} className="skeleton h-11" />)}</div>;
}
