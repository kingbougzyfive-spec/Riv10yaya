/** Animated, theme-aware background: soft floating colour orbs behind glass surfaces. */
export function Aurora() {
  return (
    <div className="aurora" aria-hidden>
      <div className="orb animate-float h-[28rem] w-[28rem] -left-24 top-[8%]" style={{ background: "rgb(var(--brand))" }} />
      <div className="orb animate-float-slow h-[24rem] w-[24rem] right-[-6rem] top-[40%]" style={{ background: "rgb(var(--accent))", animationDelay: "-6s" }} />
      <div className="orb animate-float h-[20rem] w-[20rem] left-[35%] bottom-[-8rem]" style={{ background: "#6366f1", animationDelay: "-11s", opacity: 0.3 }} />
      <div className="absolute inset-0 opacity-[.035]" style={{ backgroundImage: "radial-gradient(rgb(var(--fg)) 1px, transparent 1px)", backgroundSize: "26px 26px" }} />
    </div>
  );
}
