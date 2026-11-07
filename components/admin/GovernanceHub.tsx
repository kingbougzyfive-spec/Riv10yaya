"use client";
import { motion } from "framer-motion";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { Committees } from "./gov/Committees";
import { Departments } from "./gov/Departments";
import { Documents } from "./gov/Documents";
import { Leadership } from "./gov/Leadership";
import { Meetings } from "./gov/Meetings";
import type { Me } from "./gov/shared";
import { Tasks } from "./gov/Tasks";

const TABS = ["Leadership", "Departments", "Committees", "Tasks", "Meetings", "Documents"] as const;

export function GovernanceHub({ me, canEdit }: { me: Me; canEdit: boolean }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Leadership");
  return (
    <>
      <div className="glass mb-5 flex gap-1 overflow-x-auto p-1">{TABS.map((t) => <button key={t} onClick={() => setTab(t)} className={cn("relative whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold", tab === t ? "text-[#04130d]" : "text-white/60")}>{tab === t && <motion.span layoutId="gov-tab" className="absolute inset-0 rounded-xl bg-brand" />}<span className="relative">{t}</span></button>)}</div>
      {!canEdit && <p className="mb-4 rounded-xl bg-white/5 p-3 text-sm text-white/60">You have read-only access.</p>}
      {tab === "Leadership" && <Leadership me={me} canEdit={canEdit} />}
      {tab === "Departments" && <Departments me={me} canEdit={canEdit} />}
      {tab === "Committees" && <Committees me={me} canEdit={canEdit} />}
      {tab === "Tasks" && <Tasks me={me} canEdit={canEdit} />}
      {tab === "Meetings" && <Meetings me={me} canEdit={canEdit} />}
      {tab === "Documents" && <Documents me={me} canEdit={canEdit} />}
    </>
  );
}
