"use client";
import { AnimatePresence, motion } from "framer-motion";
import { Eye, Image as ImageIcon, Info, Layers, LayoutTemplate, Loader2, Mail, Monitor, Palette, Pencil, RotateCcw, Save, Smartphone, Tablet, Users, Hash, ToggleLeft } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { AboutView, HomeView, SimplePage } from "@/components/site/views";
import { ContactBlock, Gallery, Leaders } from "@/components/site/blocks";
import { api } from "@/lib/fetcher";
import { cn } from "@/lib/cn";
import { themeVars, type SiteData } from "@/lib/site-types";
import { AreaField, ColorField, ImageField, RepeatList, TextField, Toggle } from "./fields";

const TABS = [
  { id: "brand", label: "Brand", icon: Palette },
  { id: "hero", label: "Hero", icon: LayoutTemplate },
  { id: "welcome", label: "Welcome", icon: Pencil },
  { id: "about", label: "About", icon: Info },
  { id: "numbers", label: "Numbers", icon: Hash },
  { id: "leaders", label: "Leaders", icon: Users },
  { id: "gallery", label: "Gallery", icon: ImageIcon },
  { id: "contact", label: "Contact", icon: Mail },
  { id: "sections", label: "Sections", icon: ToggleLeft },
] as const;
type Tab = (typeof TABS)[number]["id"];

const DEVICES = { mobile: { w: 390, icon: Smartphone }, tablet: { w: 768, icon: Tablet }, desktop: { w: 1280, icon: Monitor } } as const;
type Device = keyof typeof DEVICES;
const PAGES = ["home", "about", "leadership", "gallery", "contact"] as const;
type PageKey = (typeof PAGES)[number];

export function SiteEditor({ initial, updatedAt }: { initial: SiteData; updatedAt: string | null }) {
  const toast = useToast();
  const [saved, setSaved] = useState<SiteData>(initial);
  const [draft, setDraft] = useState<SiteData>(initial);
  const [tab, setTab] = useState<Tab>("brand");
  const [device, setDevice] = useState<Device>("desktop");
  const [page, setPage] = useState<PageKey>("home");
  const [view, setView] = useState<"edit" | "preview">("edit");
  const [saving, setSaving] = useState(false);
  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(saved), [draft, saved]);

  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const upd = <K extends keyof SiteData>(k: K, patch: Partial<SiteData[K]> | SiteData[K]) =>
    setDraft((d) => ({ ...d, [k]: Array.isArray(patch) || typeof patch !== "object" || patch === null ? patch : { ...(d[k] as object), ...(patch as object) } }) as SiteData);

  async function publish() {
    setSaving(true);
    try { await api("/api/site", { method: "PUT", json: draft }); setSaved(draft); toast.ok("Published! Your website is updated."); }
    catch (e: any) { toast.err(e.message); }
    setSaving(false);
  }

  const form = (
    <div className="space-y-5">
      {tab === "brand" && (<>
        <TextField label="Organisation name" value={draft.brand.name} onChange={(v) => upd("brand", { name: v })} max={80} />
        <TextField label="Short name" hint="Shown in the header and on the installed app icon." value={draft.brand.shortName} onChange={(v) => upd("brand", { shortName: v })} max={30} />
        <TextField label="Tagline" value={draft.brand.tagline} onChange={(v) => upd("brand", { tagline: v })} max={160} />
        <ImageField label="Logo" hint="Upload a PNG, JPG or WebP (a transparent PNG looks best), up to 4 MB. Press Change, then upload a new image or pick one you uploaded before. Press Publish to put it live." value={draft.brand.logoId} onChange={(v) => upd("brand", { logoId: v })} />
        <div className="grid gap-4 sm:grid-cols-2">
          <ColorField label="Primary colour" hint="Buttons, highlights" value={draft.brand.primary} onChange={(v) => upd("brand", { primary: v })} />
          <ColorField label="Accent colour" hint="Gradients, badges" value={draft.brand.accent} onChange={(v) => upd("brand", { accent: v })} />
        </div>
      </>)}
      {tab === "hero" && (<>
        <TextField label="Small badge text" value={draft.hero.badge} onChange={(v) => upd("hero", { badge: v })} max={80} />
        <AreaField label="Headline" rows={2} max={140} value={draft.hero.title} onChange={(v) => upd("hero", { title: v })} />
        <AreaField label="Sub-headline" rows={3} max={400} value={draft.hero.subtitle} onChange={(v) => upd("hero", { subtitle: v })} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Main button text" value={draft.hero.ctaText} onChange={(v) => upd("hero", { ctaText: v })} max={40} />
          <TextField label="Main button link" placeholder="/about" value={draft.hero.ctaLink} onChange={(v) => upd("hero", { ctaLink: v })} />
          <TextField label="Second button text" value={draft.hero.secondaryText} onChange={(v) => upd("hero", { secondaryText: v })} max={40} />
          <TextField label="Second button link" placeholder="/install" value={draft.hero.secondaryLink} onChange={(v) => upd("hero", { secondaryLink: v })} />
        </div>
        <ImageField label="Slide 1 photo" hint="Wide (landscape) photos look best. Leave empty for a colour gradient." value={draft.hero.imageId} onChange={(v) => upd("hero", { imageId: v })} />
        <div className="border-t border-white/10 pt-4">
          <p className="mb-1 text-sm font-bold">More slides</p>
          <p className="mb-3 text-xs text-white/65">The slider starts with the hero above, then shows these. With no extra slides the hero stays a single banner.</p>
          <RepeatList items={draft.slides} onChange={(v) => upd("slides", v)} blank={{ badge: "", title: "", subtitle: "", ctaText: "", ctaLink: "", secondaryText: "", secondaryLink: "", imageId: "" }} addLabel="Add a slide" max={8} title={(s) => s.title || "New slide"}
            render={(s, set) => (<div className="space-y-3">
              <TextField label="Small badge text" value={s.badge} onChange={(v) => set({ badge: v })} max={80} />
              <AreaField label="Headline" rows={2} max={140} value={s.title} onChange={(v) => set({ title: v })} />
              <AreaField label="Sub-headline" rows={2} max={400} value={s.subtitle} onChange={(v) => set({ subtitle: v })} />
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField label="Button text" value={s.ctaText} onChange={(v) => set({ ctaText: v })} max={40} />
                <TextField label="Button link" placeholder="/events" value={s.ctaLink} onChange={(v) => set({ ctaLink: v })} />
                <TextField label="Second button text" value={s.secondaryText} onChange={(v) => set({ secondaryText: v })} max={40} />
                <TextField label="Second button link" value={s.secondaryLink} onChange={(v) => set({ secondaryLink: v })} />
              </div>
              <ImageField label="Photo" value={s.imageId} onChange={(v) => set({ imageId: v })} />
            </div>)} />
        </div>
      </>)}
      {tab === "welcome" && (<>
        <TextField label="Heading" value={draft.welcome.heading} onChange={(v) => upd("welcome", { heading: v })} max={120} />
        <AreaField label="Welcome message" rows={7} max={2000} value={draft.welcome.body} onChange={(v) => upd("welcome", { body: v })} />
        <ImageField label="Photo (optional)" value={draft.welcome.imageId} onChange={(v) => upd("welcome", { imageId: v })} />
      </>)}
      {tab === "about" && (<>
        <TextField label="About heading" value={draft.about.heading} onChange={(v) => upd("about", { heading: v })} max={120} />
        <AreaField label="About us" rows={8} max={6000} value={draft.about.body} onChange={(v) => upd("about", { body: v })} />
        <ImageField label="About photo (optional)" value={draft.about.imageId} onChange={(v) => upd("about", { imageId: v })} />
        <AreaField label="Mission" rows={4} max={1200} value={draft.mission} onChange={(v) => upd("mission", v)} />
        <AreaField label="Vision" rows={4} max={1200} value={draft.vision} onChange={(v) => upd("vision", v)} />
      </>)}
      {tab === "numbers" && (<>
        <p className="rounded-xl bg-white/5 p-3 text-xs text-white/65">Zones, Areas and Parishes are counted automatically from your Organisation data on the live site. Add any extra figures here (e.g. “Members”).</p>
        <RepeatList items={draft.stats} onChange={(v) => upd("stats", v)} blank={{ label: "", value: "" }} addLabel="Add a number" max={8} title={(s) => `${s.value} ${s.label}`}
          render={(s, set) => (<div className="grid grid-cols-2 gap-3"><TextField label="Label" value={s.label} onChange={(v) => set({ label: v })} /><TextField label="Value" value={s.value} onChange={(v) => set({ value: v })} /></div>)} />
      </>)}
      {tab === "leaders" && (
        <RepeatList items={draft.leaders} onChange={(v) => upd("leaders", v)} blank={{ name: "", role: "", bio: "", photoId: "" }} addLabel="Add a leader" max={40} title={(l) => l.name}
          render={(l, set) => (<>
            <ImageField label="Photo" round value={l.photoId} onChange={(v) => set({ photoId: v })} />
            <TextField label="Full name" value={l.name} onChange={(v) => set({ name: v })} max={80} />
            <TextField label="Role" placeholder="e.g. Provincial Coordinator" value={l.role} onChange={(v) => set({ role: v })} max={80} />
            <AreaField label="Short bio" rows={3} max={600} value={l.bio} onChange={(v) => set({ bio: v })} />
          </>)} />
      )}
      {tab === "gallery" && (
        <RepeatList items={draft.gallery} onChange={(v) => upd("gallery", v)} blank={{ imageId: "", caption: "" }} addLabel="Add a photo" max={60} title={(g) => g.caption || "Photo"}
          render={(g, set) => (<><ImageField label="Photo" value={g.imageId} onChange={(v) => set({ imageId: v })} /><TextField label="Caption" value={g.caption} onChange={(v) => set({ caption: v })} max={160} /></>)} />
      )}
      {tab === "contact" && (<>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Email" value={draft.contact.email} onChange={(v) => upd("contact", { email: v })} />
          <TextField label="Phone" value={draft.contact.phone} onChange={(v) => upd("contact", { phone: v })} />
        </div>
        <TextField label="Address" value={draft.contact.address} onChange={(v) => upd("contact", { address: v })} max={240} />
        <TextField label="Hours" placeholder="Sundays 9am – 12pm" value={draft.contact.hours} onChange={(v) => upd("contact", { hours: v })} max={160} />
        <h3 className="pt-2 text-sm font-bold">Social links</h3>
        {(["facebook", "instagram", "youtube", "x", "whatsapp"] as const).map((k) => (
          <TextField key={k} label={k === "x" ? "X (Twitter)" : k[0].toUpperCase() + k.slice(1)} placeholder="https://…" value={draft.social[k]} onChange={(v) => upd("social", { [k]: v })} />
        ))}
        <TextField label="Footer note" value={draft.footer.note} onChange={(v) => upd("footer", { note: v })} max={240} />
      </>)}
      {tab === "sections" && (<>
        <p className="text-xs text-white/65">Turn home page sections on or off. The preview updates instantly.</p>
        <Toggle label="Numbers strip" checked={draft.sections.stats} onChange={(v) => upd("sections", { stats: v })} />
        <Toggle label="Leadership highlights" checked={draft.sections.leadership} onChange={(v) => upd("sections", { leadership: v })} />
        <Toggle label="Gallery preview" checked={draft.sections.gallery} onChange={(v) => upd("sections", { gallery: v })} />
        <Toggle label="Contact section" checked={draft.sections.contact} onChange={(v) => upd("sections", { contact: v })} />
      </>)}
    </div>
  );

  return (
    <div>
      {/* Sticky action bar */}
      <div className="glass-strong sticky top-[3.4rem] z-20 mb-5 flex flex-wrap items-center justify-between gap-3 px-4 py-3 lg:top-3">
        <div className="flex items-center gap-2 text-sm">
          <AnimatePresence mode="wait">
            <motion.span key={String(dirty)} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={cn("badge", dirty ? "badge-warn" : "badge-ok")}>
              {dirty ? "Unsaved changes" : "All changes published"}
            </motion.span>
          </AnimatePresence>
          {updatedAt && !dirty && <span className="hidden text-xs text-white/65 sm:inline">Last published {new Date(updatedAt).toLocaleString("en-NG")}</span>}
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost btn-sm" disabled={!dirty || saving} onClick={() => setDraft(saved)}><RotateCcw className="h-3.5 w-3.5" />Undo</button>
          <button className="btn btn-primary btn-sm" disabled={!dirty || saving} onClick={publish}>{saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}Publish</button>
        </div>
      </div>

      {/* Mobile toggle */}
      <div className="glass mb-4 grid grid-cols-2 gap-1 p-1 xl:hidden">
        {(["edit", "preview"] as const).map((v) => (
          <button key={v} onClick={() => setView(v)} className={cn("relative rounded-xl py-2 text-sm font-semibold capitalize", view === v ? "text-[#04130d]" : "text-white/65")}>
            {view === v && <motion.span layoutId="ed-toggle" className="absolute inset-0 rounded-xl bg-brand" />}
            <span className="relative flex items-center justify-center gap-2">{v === "edit" ? <Pencil className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}{v}</span>
          </button>
        ))}
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className={cn(view === "preview" && "hidden xl:block")}>
          <div className="mb-4 flex gap-1.5 overflow-x-auto pb-2">
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)} className={cn("relative flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition", tab === t.id ? "text-white" : "text-white/65 hover:text-white")}>
                {tab === t.id && <motion.span layoutId="ed-tab" className="absolute inset-0 rounded-xl border border-brand/30 bg-brand/15" />}
                <t.icon className="relative h-4 w-4" /><span className="relative">{t.label}</span>
              </button>
            ))}
          </div>
          <AnimatePresence mode="wait">
            <motion.div key={tab} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="glass p-5 sm:p-6">{form}</motion.div>
          </AnimatePresence>
        </div>

        <div className={cn("xl:sticky xl:top-20", view === "edit" && "hidden xl:block")}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-1 overflow-x-auto">
              {PAGES.map((p) => <button key={p} onClick={() => setPage(p)} className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold capitalize", page === p ? "bg-white/15 text-white" : "text-white/65 hover:text-white")}>{p}</button>)}
            </div>
            <div className="glass flex gap-1 p-1">
              {(Object.keys(DEVICES) as Device[]).map((d) => { const I = DEVICES[d].icon; return (
                <button key={d} onClick={() => setDevice(d)} aria-label={d} className={cn("rounded-lg p-1.5", device === d ? "bg-brand text-[#04130d]" : "text-white/65")}><I className="h-4 w-4" /></button>); })}
            </div>
          </div>
          <PreviewPane site={draft} device={device} page={page} />
          <p className="mt-2 text-center text-[11px] text-white/65">Live preview · links are disabled here · nothing is public until you press Publish</p>
        </div>
      </div>
    </div>
  );
}

function PreviewPane({ site, device, page }: { site: SiteData; device: Device; page: PageKey }) {
  const box = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [boxW, setBoxW] = useState(600);
  const [innerH, setInnerH] = useState(800);
  useEffect(() => {
    const a = new ResizeObserver(() => setBoxW(box.current?.clientWidth || 600));
    const b = new ResizeObserver(() => setInnerH(inner.current?.scrollHeight || 800));
    if (box.current) a.observe(box.current);
    if (inner.current) b.observe(inner.current);
    return () => { a.disconnect(); b.disconnect(); };
  }, []);
  const w = DEVICES[device].w;
  const scale = Math.min(1, (boxW - (device === "desktop" ? 0 : 0)) / w);
  const shownW = w * scale;
  return (
    <div ref={box} className="glass overflow-hidden p-0">
      <div className="max-h-[75dvh] overflow-y-auto overflow-x-hidden bg-[rgb(var(--bg))]" style={{ height: "75dvh" }}>
        <div style={{ width: shownW, height: innerH * scale, margin: "0 auto", transition: "width .4s cubic-bezier(.2,.8,.2,1)" }}>
          <div
            ref={inner}
            className="preview-frame relative"
            style={{ width: w, transform: `scale(${scale})`, transformOrigin: "top left", transition: "width .4s", ...(themeVars(site) as React.CSSProperties) }}
            onClickCapture={(e) => { if ((e.target as HTMLElement).closest("a")) e.preventDefault(); }}
          >
            {page === "home" && <HomeView site={site} preview />}
            {page === "about" && <AboutView site={site} />}
            {page === "leadership" && <SimplePage site={site} current="/leadership"><div className="pt-8"><Leaders site={site} /></div></SimplePage>}
            {page === "gallery" && <SimplePage site={site} current="/gallery"><div className="pt-8"><Gallery site={site} /></div></SimplePage>}
            {page === "contact" && <SimplePage site={site} current="/contact"><div className="pt-8"><ContactBlock site={site} /></div></SimplePage>}
          </div>
        </div>
      </div>
    </div>
  );
}
