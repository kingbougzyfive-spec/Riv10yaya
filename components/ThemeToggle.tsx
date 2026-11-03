"use client";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

/** Dark is the default. The choice is remembered per device (storage failures are ignored). */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const [light, setLight] = useState(false);
  useEffect(() => { setLight(document.documentElement.dataset.theme === "light"); }, []);
  function flip() {
    const next = light ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("yaya-theme", next); } catch {}
    setLight(!light);
  }
  return (
    <button type="button" onClick={flip} aria-label={light ? "Switch to dark mode" : "Switch to light mode"} title={light ? "Dark mode" : "Light mode"} className={`btn btn-ghost btn-sm !p-2 ${className}`}>
      {light ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
    </button>
  );
}
