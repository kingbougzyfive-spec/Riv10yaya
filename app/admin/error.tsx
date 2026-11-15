"use client";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useState } from "react";

/** Shown inside the admin area (the menu and header stay). A hiccup on the server retries by itself; a bug in the page does not loop. */
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  const [tries, setTries] = useState(0);
  const retry = () => startTransition(() => { router.refresh(); reset(); });
  // Server problems carry a digest and are usually a brief database or cold-start hiccup. A page that crashes while drawing has none, and retrying cannot fix it.
  const transient = !!error.digest;
  useEffect(() => { console.error(error); }, [error]);
  useEffect(() => {
    if (!transient || tries >= 3) return;
    const t = setTimeout(() => { setTries((n) => n + 1); retry(); }, 2500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tries, transient]);
  const retrying = transient && tries < 3;
  return (
    <div className="glass mx-auto mt-8 max-w-md p-8 text-center" role="alert">
      <h2 className="text-lg font-bold">{retrying ? "Reconnecting…" : "This page hit a problem"}</h2>
      <p className="mt-2 text-sm text-white/65">{retrying ? "This is usually a brief hiccup. Retrying automatically. You are still signed in." : "You are still signed in and the rest of the dashboard works. Try again, or open another page from the menu."}</p>
      {error.digest && <p className="mt-2 font-mono text-[11px] text-white/65">Ref: {error.digest}</p>}
      <button onClick={() => { setTries(0); retry(); }} className="btn btn-primary mt-5">Try again</button>
    </div>
  );
}
