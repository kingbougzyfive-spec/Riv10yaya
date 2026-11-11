/** Quiet, static background wash. No motion, so it never distracts from the work. */
export function Aurora() {
  return (
    <div className="aurora" aria-hidden>
      <div className="orb -left-24 top-[8%] h-[26rem] w-[26rem]" style={{ background: "rgb(var(--brand))" }} />
    </div>
  );
}
