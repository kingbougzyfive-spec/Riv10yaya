"use client";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useState } from "react";

/** Most "errors" on a serverless host are a brief database or cold-start hiccup. Retry quietly a few times before asking the person to. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  const [tries, setTries] = useState(0);
  const retry = () => startTransition(() => { router.refresh(); reset(); });
  useEffect(() => { console.error(error); }, [error]);
  useEffect(() => {
    if (tries >= 4) return;
    const t = setTimeout(() => { setTries((n) => n + 1); retry(); }, 2500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tries]);
  const retrying = tries < 4;
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="glass max-w-md p-10 text-center" role="status" aria-live="polite">
        <h1 className="text-xl font-bold">{retrying ? "Reconnecting…" : "We couldn't load this page"}</h1>
        <p className="mt-2 text-sm text-white/65">{retrying ? "This is usually a brief hiccup. Retrying automatically. You are still signed in." : "The server or database isn't responding. You are still signed in. Please try again in a moment."}</p>
        {error.digest && <p className="mt-2 font-mono text-[11px] text-white/65">Ref: {error.digest}</p>}
        <button onClick={() => { setTries(0); retry(); }} className="btn btn-primary mt-6">Try again now</button>
      </div>
    </main>
  );
}
