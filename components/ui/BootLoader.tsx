"use client";
import { useEffect, useState } from "react";
import { LogoLoader } from "./LogoLoader";

const SHOW_AT_LEAST_MS = 900; // measured from the moment the person opened the page, so a slow load never waits any longer than it must

/**
 * The first thing on screen when the site is opened: the animated crest, covering the page until it has finished loading, then fading away.
 * It is part of the page's HTML, so it appears before any script has run. (If scripts never run, a CSS rule hides it by itself after a few seconds.)
 */
export function BootLoader() {
  const [phase, setPhase] = useState<"show" | "out" | "gone">("show");
  useEffect(() => {
    let t1: ReturnType<typeof setTimeout>, t2: ReturnType<typeof setTimeout>;
    const finish = () => {
      t1 = setTimeout(() => { setPhase("out"); t2 = setTimeout(() => setPhase("gone"), 600); }, Math.max(0, SHOW_AT_LEAST_MS - performance.now()));
    };
    if (document.readyState === "complete") finish(); else window.addEventListener("load", finish, { once: true });
    return () => { clearTimeout(t1); clearTimeout(t2); window.removeEventListener("load", finish); };
  }, []);
  if (phase === "gone") return null;
  return <LogoLoader fullscreen size={150} label="Loading" className={`ll-boot ${phase === "out" ? "ll-out" : ""}`} />;
}
