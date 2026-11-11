"use client";
import { motion } from "framer-motion";
import { Check, Loader2, Trash2, Upload } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { api } from "@/lib/fetcher";
import { cn } from "@/lib/cn";

export type MediaItem = { id: string; name: string; mime: string; size: number };

/** Shrinks big photos in the browser so phone uploads stay well under the 4 MB limit. */
async function prepare(file: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 900_000) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 2200 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    const blob: Blob | null = await new Promise((r) => c.toBlob(r, "image/webp", 0.86));
    if (blob && blob.size < file.size) return new File([blob], file.name.replace(/\.\w+$/, ".webp"), { type: "image/webp" });
  } catch {}
  return file;
}

function useMedia() {
  const toast = useToast();
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const load = useCallback(() => api("/api/media").then((r) => setItems(r.items)).catch((e) => { toast.err(e.message); setItems([]); }), [toast]);
  useEffect(() => { load(); }, [load]);
  async function upload(files: FileList | File[]): Promise<string | undefined> {
    setUploading(true);
    let last: string | undefined;
    for (const f of Array.from(files)) {
      try {
        const fd = new FormData();
        fd.append("file", await prepare(f));
        const r = await api("/api/media", { method: "POST", body: fd });
        last = r.id;
      } catch (e: any) { toast.err(`${f.name}: ${e.message}`); }
    }
    setUploading(false);
    await load();
    if (last) toast.ok("Uploaded");
    return last;
  }
  return { items, uploading, upload, load };
}

function DropZone({ onFiles, uploading }: { onFiles: (f: FileList) => void; uploading: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files); }}
      onClick={() => ref.current?.click()}
      className={cn("flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/15 p-6 text-center transition", over && "border-brand bg-brand/10")}
    >
      <input ref={ref} type="file" accept="image/*" multiple hidden onChange={(e) => e.target.files && onFiles(e.target.files)} />
      {uploading ? <Loader2 className="h-6 w-6 animate-spin text-brand" /> : <Upload className="h-6 w-6 text-brand" />}
      <p className="text-sm font-semibold">{uploading ? "Uploading…" : "Tap to upload, or drop images here"}</p>
      <p className="text-xs text-white/65">PNG, JPG, WebP, GIF or SVG · large photos are shrunk automatically</p>
    </div>
  );
}

export function MediaPickerModal({ open, onClose, onPick, current }: { open: boolean; onClose: () => void; onPick: (id: string) => void; current?: string }) {
  const { items, uploading, upload } = useMedia();
  return (
    <Modal open={open} onClose={onClose} title="Choose an image" wide>
      <DropZone uploading={uploading} onFiles={async (f) => { const id = await upload(f); if (id && f.length === 1) { onPick(id); onClose(); } }} />
      <div className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
        {items === null && Array.from({ length: 10 }).map((_, i) => <div key={i} className="skeleton aspect-square" />)}
        {items?.map((m, i) => (
          <motion.button key={m.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: Math.min(i * 0.02, 0.4) }}
            onClick={() => { onPick(m.id); onClose(); }}
            className={cn("group relative aspect-square overflow-hidden rounded-xl border border-white/10 bg-white/5 transition hover:border-brand", current === m.id && "ring-2 ring-brand")}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/media/${m.id}`} alt={m.name} loading="lazy" className="h-full w-full object-cover transition group-hover:scale-110" />
            {current === m.id && <span className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-brand text-[#04130d]"><Check className="h-3 w-3" /></span>}
          </motion.button>
        ))}
        {items?.length === 0 && <p className="col-span-full py-6 text-center text-sm text-white/65">No images yet. Upload your first one above.</p>}
      </div>
    </Modal>
  );
}

export function MediaManager() {
  const toast = useToast();
  const confirm = useConfirm();
  const { items, uploading, upload, load } = useMedia();
  const [busyId, setBusyId] = useState<string | null>(null);
  return (
    <>
      <DropZone uploading={uploading} onFiles={upload} />
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {items === null && Array.from({ length: 10 }).map((_, i) => <div key={i} className="skeleton aspect-square" />)}
        {items?.map((m, i) => (
          <motion.div key={m.id} layout initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.5) }} className="glass glass-hover group relative overflow-hidden p-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/media/${m.id}`} alt={m.name} loading="lazy" className="aspect-square w-full rounded-xl object-cover" />
            <div className="flex items-center justify-between gap-2 px-1.5 py-2">
              <div className="min-w-0"><p className="truncate text-xs font-medium">{m.name}</p><p className="text-[10px] text-white/65">{Math.round((m.size || 0) / 1024)} KB</p></div>
              <button className="btn btn-danger btn-sm !p-1.5" disabled={busyId === m.id} aria-label="Delete"
                onClick={async () => {
                  if (!(await confirm({ title: `Delete "${m.name}"?`, message: "Pages using it will show a placeholder.", confirmLabel: "Delete" }))) return;
                  setBusyId(m.id);
                  try { await api(`/api/media/${m.id}`, { method: "DELETE" }); toast.ok("Deleted"); await load(); } catch (e: any) { toast.err(e.message); }
                  setBusyId(null);
                }}>{busyId === m.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}</button>
            </div>
          </motion.div>
        ))}
      </div>
      {items?.length === 0 && <p className="mt-8 text-center text-white/65">Your library is empty. Upload logos, event flyers and photos to use across the site.</p>}
    </>
  );
}
