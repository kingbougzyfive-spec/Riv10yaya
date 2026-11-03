"use client";
import { Loader2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/ui/Toast";
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
