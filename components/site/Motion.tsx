"use client";
import { animate, motion, useInView, useScroll, useSpring } from "framer-motion";
import { useEffect, useRef, useState } from "react";

/** Counts a number up from zero when it scrolls into view. Values like "120+" keep their prefix and suffix. */
export function CountUp({ value, duration = 1.6 }: { value: string; duration?: number }) {
  const m = /^(\D*)(\d[\d,]*)(.*)$/.exec(String(value).trim());
  const target = m ? Number(m[2].replace(/,/g, "")) : 0;
  const grouped = !!m && m[2].includes(",");
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  // The server renders the real number, so nothing breaks without JavaScript. The count-up only starts once the page is live.
  const [n, setN] = useState(target);
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!m || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setN(0); setArmed(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!armed || !inView) return;
    const c = animate(0, target, { duration, ease: [0.2, 0.8, 0.2, 1], onUpdate: (v) => setN(Math.round(v)) });
    return () => c.stop();
  }, [armed, inView, target, duration]);
  if (!m) return <span>{value}</span>;
  return <span ref={ref}>{m[1]}{grouped ? n.toLocaleString("en-US") : n}{m[3]}</span>;
}

/** A thin bar across the top that fills as you scroll down the page. */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const x = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.3 });
  return <motion.div aria-hidden="true" style={{ scaleX: x }} className="fixed inset-x-0 top-0 z-[60] h-[3px] origin-left bg-gradient-to-r from-brand to-accent" />;
}

/** The little accent line under a section title that draws itself when you reach it. */
export function TitleBar() {
  return <motion.span aria-hidden="true" className="mt-3 block h-[3px] w-14 origin-left rounded-full bg-gradient-to-r from-brand to-accent" initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={{ duration: 0.8, delay: 0.25, ease: [0.2, 0.8, 0.2, 1] }} />;
}
