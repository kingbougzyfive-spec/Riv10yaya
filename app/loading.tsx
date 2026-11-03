export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl space-y-5 px-5 py-14" aria-busy="true" aria-label="Loading">
      <div className="skeleton h-14 w-2/3" /><div className="skeleton h-5 w-1/2" /><div className="grid gap-5 pt-6 sm:grid-cols-3"><div className="skeleton h-44" /><div className="skeleton h-44" /><div className="skeleton h-44" /></div>
    </div>
  );
}
