"use client";
import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  const dbProblem = /database|reach any configured|No database/i.test(error.message);
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="glass max-w-md p-10 text-center">
        <h1 className="text-xl font-bold">{dbProblem ? "We can't reach the database" : "Something went wrong"}</h1>
        <p className="mt-2 text-sm text-white/65">{dbProblem ? "This is usually temporary. If it continues, the Super Administrator can check Admin → Databases." : "Please try again. If it keeps happening, tell your administrator."}</p>
        {error.digest && <p className="mt-2 font-mono text-[11px] text-white/65">Ref: {error.digest}</p>}
        <button onClick={reset} className="btn btn-primary mt-6">Try again</button>
      </div>
    </main>
  );
}
