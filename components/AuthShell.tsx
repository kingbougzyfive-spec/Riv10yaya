"use client";
import { motion } from "framer-motion";
import type { ReactNode } from "react";

export function AuthShell({ title, subtitle, children, wide }: { title: string; subtitle?: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
        className={`glass w-full ${wide ? "max-w-xl" : "max-w-md"} p-7 sm:p-9`}
      >
        <h1 className="gradient-text text-2xl font-black sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-2 text-sm text-white/65">{subtitle}</p>}
        <div className="mt-7">{children}</div>
      </motion.div>
    </div>
  );
}
