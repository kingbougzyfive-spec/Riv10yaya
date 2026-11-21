import type { CSSProperties } from "react";

/** A small, optimised copy of the crest. It is also preloaded in the page head, so it is ready the moment the loader appears. */
export const LOADER_LOGO = "/brand/loader-logo.webp";

/**
 * The crest as a loading spinner: a ring that spins around it, a counter-turning dashed ring, a soft breathing glow and a light sweep that
 * passes over the crest itself. Pure CSS (no JavaScript, no database), so it can be shown the instant a page starts to load.
 * People who ask their device for reduced motion get the same picture without the movement (see globals.css).
 * `delayed` keeps it invisible for the first fraction of a second, so pages that open quickly never flash a loader.
 */
export function LogoLoader({ size = 128, label = "Loading", delayed = false, fullscreen = false, className = "" }: { size?: number; label?: string; delayed?: boolean; fullscreen?: boolean; className?: string }) {
  const style = { "--ll": `${size}px`, "--ll-logo": `url(${LOADER_LOGO})` } as CSSProperties;
  return (
    <div role="status" aria-live="polite" aria-busy="true" className={`ll ${fullscreen ? "ll-full" : ""} ${delayed ? "ll-delayed" : ""} ${className}`} style={style}>
      <div className="ll-stage">
        <span className="ll-halo" aria-hidden="true" />
        <span className="ll-ring-b" aria-hidden="true" />
        <span className="ll-ring-a" aria-hidden="true" />
        <span className="ll-crest" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOADER_LOGO} alt="" width={300} height={420} decoding="async" fetchPriority="high" draggable={false} />
          <span className="ll-shine" />
        </span>
      </div>
      <p className="ll-label" aria-hidden="true">{label}<span className="ll-dots"><i /><i /><i /></span></p>
      <span className="sr-only">{label}, please wait</span>
    </div>
  );
}
