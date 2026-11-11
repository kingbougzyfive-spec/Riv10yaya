"use client";
import { motion } from "framer-motion";
import { Megaphone, Pin, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/fetcher";

const img = (id: string) => (id ? `/api/media/${id}` : "");

export function AnnouncementsList({ limit }: { limit?: number }) {
  const [rows, setRows] = useState<any[] | null>(null);
  useEffect(() => { api(`/api/public/announcements${limit ? `?limit=${limit}` : ""}`).then((r) => setRows(r.rows)).catch(() => setRows([])); }, [limit]);
  return (
    <div className="grid gap-5 md:grid-cols-2">
      {rows === null && [0, 1].map((i) => <div key={i} className="skeleton h-48" />)}
      {rows?.map((a, i) => (
        <motion.article key={a.id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: (i % 2) * 0.08 }} className="glass glass-hover overflow-hidden p-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {a.imageId && <img src={img(a.imageId)} alt="" className="h-48 w-full object-cover" />}
          <div className="p-5"><p className="flex items-center gap-2 text-xs font-semibold text-accent">{a.pinned && <Pin className="h-3 w-3" />}{a.publishedAt && new Date(a.publishedAt).toLocaleDateString("en-NG", { dateStyle: "long" })}</p><h3 className="mt-1 text-lg font-bold">{a.title}</h3><p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-white/65">{a.body}</p></div>
        </motion.article>
      ))}
      {rows?.length === 0 && <p className="glass col-span-full p-10 text-center text-white/65"><Megaphone className="mx-auto mb-2 h-6 w-6 text-white/65" />No announcements yet.</p>}
    </div>
  );
}

export function DepartmentsList() {
  const [rows, setRows] = useState<any[] | null>(null);
  useEffect(() => { api("/api/public/departments").then((r) => setRows(r.rows)).catch(() => setRows([])); }, []);
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {rows === null && [0, 1, 2].map((i) => <div key={i} className="skeleton h-56" />)}
      {rows?.map((d, i) => (
        <motion.div key={d.id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: (i % 3) * 0.07 }} className="glass glass-hover overflow-hidden p-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {d.imageId ? <img src={img(d.imageId)} alt="" className="h-40 w-full object-cover" /> : <div className="grid h-40 place-items-center bg-gradient-to-br from-brand/20 to-accent/20"><Users className="h-10 w-10 text-white/65" /></div>}
          <div className="p-5"><h3 className="font-bold">{d.name}</h3>{d.headName && <p className="text-xs font-medium text-accent">Led by {d.headName}</p>}<p className="mt-2 text-sm leading-relaxed text-white/65">{d.description}</p></div>
        </motion.div>
      ))}
      {rows?.length === 0 && <p className="glass col-span-full p-10 text-center text-white/65">Departments will be listed here soon.</p>}
    </div>
  );
}
