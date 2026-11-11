"use client";
import { Loader2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { api } from "@/lib/fetcher";

export function SeedButton() {
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <div className="glass mb-4 flex flex-wrap items-center justify-between gap-3 p-4">
      <p className="flex items-center gap-2 text-sm"><Sparkles className="h-4 w-4 text-accent" />Your organisation is empty. Want clearly-labelled sample zones, parishes and content so you can explore?</p>
      <button className="btn btn-primary btn-sm" disabled={busy} onClick={async () => { setBusy(true); try { await api("/api/seed", { method: "POST" }); toast.ok("Sample content added. You can delete it any time."); router.refresh(); } catch (e: any) { toast.err(e.message); } setBusy(false); }}>{busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Add sample content</button>
    </div>
  );
}

/** Shown while sample records exist, so nobody mistakes them for real data. Removal only touches rows flagged as sample. */
export function SampleBanner({ real }: { real: number }) {
  const toast = useToast();
  const confirm = useConfirm();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const remove = async () => {
    if (!(await confirm({ title: "Remove all sample data?", message: "Only records marked as sample are deleted. Real zones, parishes, reports and payments are not touched. If real records are linked to the sample organisation, nothing is removed.", confirmLabel: "Remove sample data" }))) return;
    setBusy(true);
    try { await api("/api/seed", { method: "DELETE" }); toast.ok("Sample data removed"); router.refresh(); } catch (e: any) { toast.err(e.message); }
    setBusy(false);
  };
  return (
    <div role="note" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-400/40 bg-amber-400/5 p-4">
      <p className="text-sm"><b>Sample data is present.</b> Items named “Sample …” are for exploring only and are not real church records.{real > 0 ? ` You also have ${real} real zone${real === 1 ? "" : "s"}.` : ""}</p>
      <button className="btn btn-danger btn-sm" disabled={busy} onClick={remove}>{busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Remove sample data</button>
    </div>
  );
}
