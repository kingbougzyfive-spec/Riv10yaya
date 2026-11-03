import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="glass max-w-md animate-fade-up p-10 text-center">
        <p className="gradient-text text-6xl font-black">404</p>
        <h1 className="mt-3 text-xl font-bold">We couldn't find that page</h1>
        <p className="mt-2 text-sm text-white/55">The link may be old or mistyped.</p>
        <Link href="/" className="btn btn-primary mt-6">Back to home</Link>
      </div>
    </main>
  );
}
