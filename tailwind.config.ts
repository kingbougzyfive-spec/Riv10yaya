import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        white: "rgb(var(--fg) / <alpha-value>)",
        brand: "rgb(var(--brand) / <alpha-value>)",
        accent: "rgb(var(--accent) / <alpha-value>)",
      },
      keyframes: {
        float: { "0%,100%": { transform: "translateY(0) scale(1)" }, "50%": { transform: "translateY(-30px) scale(1.06)" } },
        shimmer: { "100%": { transform: "translateX(100%)" } },
        fadeUp: { from: { opacity: "0", transform: "translateY(14px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        pulseRing: { "0%": { boxShadow: "0 0 0 0 rgb(var(--accent) / .5)" }, "100%": { boxShadow: "0 0 0 14px rgb(var(--accent) / 0)" } },
      },
      animation: {
        float: "float 14s ease-in-out infinite",
        "float-slow": "float 22s ease-in-out infinite",
        shimmer: "shimmer 1.8s infinite",
        "fade-up": "fadeUp .6s ease both",
        "pulse-ring": "pulseRing 2s infinite",
      },
    },
  },
  plugins: [],
};
export default config;
