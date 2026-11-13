"use client";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { mediaUrl, type SiteData } from "@/lib/site-types";

type Slide = SiteData["hero"];
const INTERVAL = 6500;
const WHITE = "#fff"; // the hero always sits on a dark image or gradient, whatever the site theme

/** Full-width hero slider. Slide 1 is the main hero; extra slides come from Site Editor → Hero. */
export function HeroCarousel({ site }: { site: SiteData }) {
  const slides: Slide[] = [site.hero, ...(site.slides ?? [])].filter((s) => s.title?.trim());
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const x0 = useRef<number | null>(null);
  const n = slides.length;

  useEffect(() => { setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches); }, []);
  const go = useCallback((k: number) => setI(((k % n) + n) % n), [n]);
  useEffect(() => {
    if (n < 2 || paused || reduced) return;
    const t = setTimeout(() => go(i + 1), INTERVAL);
    return () => clearTimeout(t);
  }, [i, n, paused, reduced, go]);

  return (
    <section className="mx-auto max-w-6xl px-4 pb-6 pt-6 sm:px-6 md:pt-10" aria-roledescription="carousel" aria-label="Featured">
      <div
        className="relative overflow-hidden rounded-[1.6rem] border border-white/15 bg-[#0b1220] shadow-2xl"
        onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}
        onKeyDown={(e) => { if (e.key === "ArrowLeft") go(i - 1); if (e.key === "ArrowRight") go(i + 1); }}
        onTouchStart={(e) => { x0.current = e.touches[0].clientX; setPaused(true); }}
        onTouchEnd={(e) => { if (x0.current !== null) { const dx = e.changedTouches[0].clientX - x0.current; if (Math.abs(dx) > 45) go(i + (dx < 0 ? 1 : -1)); } x0.current = null; setPaused(false); }}
      >
        {/* every slide sits in the same grid cell, so the box is as tall as the tallest slide and nothing jumps */}
        <div className="grid [&>*]:col-start-1 [&>*]:row-start-1">
          {slides.map((s, k) => {
            const img = mediaUrl(s.imageId);
            const on = k === i;
            return (
              <article key={k} aria-hidden={!on} className={`relative flex min-h-[440px] items-center transition-all duration-700 sm:min-h-[500px] ${on ? "visible opacity-100" : "invisible opacity-0"}`}>
                {img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={img} alt="" className={`absolute inset-0 h-full w-full object-cover transition-transform duration-[7000ms] ease-out ${on ? "scale-105" : "scale-100"}`} />
                ) : (
                  <div className="absolute inset-0" style={{ background: `radial-gradient(60% 80% at 82% 18%, rgb(var(--accent) / .55), transparent 60%), radial-gradient(70% 90% at 12% 88%, rgb(var(--brand) / .7), transparent 60%), linear-gradient(135deg, #07241d, #0b1220)` }} />
                )}
                <div className="absolute inset-0" style={{ background: img ? "linear-gradient(90deg, rgba(0,0,0,.78), rgba(0,0,0,.35) 65%, rgba(0,0,0,.15))" : "linear-gradient(90deg, rgba(0,0,0,.25), transparent)" }} />
                <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
                  <span className="hero-shape" style={{ width: 280, height: 280, right: "6%", top: "6%", background: "radial-gradient(circle at 30% 30%, rgba(255,255,255,.22), rgba(255,255,255,0) 70%)" }} />
                  <span className="hero-shape" style={{ width: 150, height: 150, right: "28%", bottom: "12%", animationDuration: "9s", animationDelay: "-4s", background: "radial-gradient(circle at 35% 35%, rgb(var(--accent) / .4), transparent 70%)" }} />
                  <span className="hero-ring" style={{ width: 220, height: 220, right: "10%", bottom: "-60px" }} />
                </div>
                <div className="relative z-10 w-full max-w-2xl px-6 pb-16 pt-12 sm:px-12" style={{ color: WHITE }}>
                  {s.badge && <span className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold ${on ? "rise" : ""}`} style={{ borderColor: "rgba(255,255,255,.3)", background: "rgba(255,255,255,.14)", ["--d" as string]: ".05s" } as React.CSSProperties}><span className="h-2 w-2 rounded-full bg-accent" />{s.badge}</span>}
                  <h1 className={`mt-5 text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl ${on ? "rise" : ""}`} style={{ textShadow: "0 2px 18px rgba(0,0,0,.35)", ["--d" as string]: ".18s" } as React.CSSProperties}>{s.title}</h1>
                  {s.subtitle && <p className={`mt-4 max-w-xl text-base leading-relaxed sm:text-lg ${on ? "rise" : ""}`} style={{ color: "rgba(255,255,255,.86)", ["--d" as string]: ".34s" } as React.CSSProperties}>{s.subtitle}</p>}
                  <div className={`mt-7 flex flex-wrap gap-3 ${on ? "rise" : ""}`} style={{ ["--d" as string]: ".5s" } as React.CSSProperties}>
                    {s.ctaText && <Link tabIndex={on ? 0 : -1} href={s.ctaLink || "/"} className="btn btn-primary btn-shine px-6 py-3">{s.ctaText}<ArrowRight className="h-4 w-4" /></Link>}
                    {s.secondaryText && <Link tabIndex={on ? 0 : -1} href={s.secondaryLink || "/"} className="btn px-6 py-3" style={{ border: "1px solid rgba(255,255,255,.45)", color: WHITE, background: "transparent" }}>{s.secondaryText}</Link>}
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {n > 1 && (<>
          {/* plain chevrons: no circle, no border */}
          <button type="button" onClick={() => go(i - 1)} aria-label="Previous slide" className="absolute left-1 top-1/2 hidden h-12 w-8 -translate-y-1/2 place-items-center opacity-80 transition hover:scale-110 hover:opacity-100 sm:grid" style={{ color: WHITE, filter: "drop-shadow(0 1px 6px rgba(0,0,0,.7))" }}><ChevronLeft className="h-8 w-8" strokeWidth={2.5} /></button>
          <button type="button" onClick={() => go(i + 1)} aria-label="Next slide" className="absolute right-1 top-1/2 hidden h-12 w-8 -translate-y-1/2 place-items-center opacity-80 transition hover:scale-110 hover:opacity-100 sm:grid" style={{ color: WHITE, filter: "drop-shadow(0 1px 6px rgba(0,0,0,.7))" }}><ChevronRight className="h-8 w-8" strokeWidth={2.5} /></button>
          <div className="absolute inset-x-0 bottom-4 flex justify-center gap-2" role="tablist" aria-label="Choose slide">
            {slides.map((_, k) => (
              <button key={k} type="button" role="tab" aria-selected={k === i} aria-label={`Slide ${k + 1}`} onClick={() => go(k)} className={`h-2.5 rounded-full transition-all ${k === i ? "w-8 bg-accent" : "w-2.5 bg-[#fff]/40 hover:bg-[#fff]/70"}`} />
            ))}
          </div>
          {!reduced && <div className="absolute inset-x-0 bottom-0 h-[3px] bg-[#fff]/15"><span key={`${i}-${paused}`} className="block h-full origin-left bg-accent" style={{ animation: `heroProg ${INTERVAL}ms linear forwards`, animationPlayState: paused ? "paused" : "running" }} /></div>}
        </>)}
      </div>
    </section>
  );
}
