"use client";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Download, Facebook, Instagram, Mail, MapPin, Menu, Phone, Quote, Target, Eye, X, Youtube, Clock, MessageCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { mediaUrl, type SiteData } from "@/lib/site-types";
import { Reveal } from "@/components/ui/Reveal";
import { ThemeToggle } from "@/components/ThemeToggle";
import { HeroCarousel } from "./HeroCarousel";

export const NAV = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/events", label: "Events" },
  { href: "/announcements", label: "News" },
  { href: "/departments", label: "Departments" },
  { href: "/leadership", label: "Leadership" },
  { href: "/zones", label: "Zones & Areas" },
  { href: "/gallery", label: "Gallery" },
  { href: "/contact", label: "Contact" },
];

export function Logo({ site, size = 40 }: { site: SiteData; size?: number }) {
  const url = mediaUrl(site.brand.logoId);
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={`${site.brand.name} logo`} style={{ height: size, width: "auto", maxWidth: size * 3 }} className="object-contain drop-shadow-lg" />
  ) : (
    <div
      className="grid place-items-center rounded-2xl font-black text-[#04130d] shadow-lg"
      style={{ height: size, width: size, background: "linear-gradient(135deg, rgb(var(--brand)), rgb(var(--accent)))", fontSize: size * 0.42 }}
    >
      {site.brand.name.replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || "R"}
    </div>
  );
}

export function SiteNav({ site, current = "/" }: { site: SiteData; current?: string }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 12);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <header className="sticky top-0 z-40 px-3 pt-3 sm:px-6">
      <motion.nav
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
        className={cn("glass mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5 transition-all", scrolled && "glass-strong shadow-2xl")}
      >
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <Logo site={site} size={38} />
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-bold">{site.brand.shortName || site.brand.name}</p>
            <p className="hidden truncate text-[11px] text-white/65 sm:block">{site.brand.tagline}</p>
          </div>
        </Link>
        <div className="hidden items-center gap-1 lg:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={cn("relative rounded-lg px-3 py-2 text-sm text-white/70 transition hover:text-white", current === n.href && "text-white")}>
              {current === n.href && <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-lg bg-white/10" />}
              <span className="relative">{n.label}</span>
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Link href="/install" className="btn btn-primary btn-sm hidden sm:inline-flex"><Download className="h-3.5 w-3.5" />Install</Link>
          <ThemeToggle />
          <Link href="/login" className="btn btn-ghost btn-sm">Sign in</Link>
          <button className="btn btn-ghost btn-sm lg:hidden" onClick={() => setOpen((o) => !o)} aria-label="Menu">{open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}</button>
        </div>
      </motion.nav>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            className="glass-strong mx-auto mt-2 max-w-6xl p-2 lg:hidden"
            style={{ borderRadius: "1.25rem" }}
          >
            {[...NAV, { href: "/install", label: "Install App" }].map((n, i) => (
              <motion.div key={n.href} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
                <Link href={n.href} onClick={() => setOpen(false)} className={cn("block rounded-xl px-4 py-3 text-sm hover:bg-white/10", current === n.href && "bg-white/10 font-semibold")}>{n.label}</Link>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

export function Hero({ site }: { site: SiteData }) {
  return <HeroCarousel site={site} />;
}

export function Stats({ site, live }: { site: SiteData; live?: { zones: number; areas: number; parishes: number } | null }) {
  const items = live
    ? [{ label: "Zones", value: String(live.zones) }, { label: "Areas", value: String(live.areas) }, { label: "Parishes", value: String(live.parishes) }, ...site.stats.filter((s) => !["zones", "areas", "parishes"].includes(s.label.toLowerCase()))]
    : site.stats;
  if (!items.length) return null;
  return (
    <section className="mx-auto max-w-6xl px-5 sm:px-6">
      <div className="glass grid grid-cols-2 gap-px overflow-hidden p-0 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((s, i) => (
          <Reveal key={i} delay={i * 0.06} className="bg-white/[.02] p-6 text-center">
            <p className="gradient-text text-3xl font-black sm:text-4xl">{s.value}</p>
            <p className="mt-1 text-xs uppercase tracking-widest text-white/65">{s.label}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

export function SectionTitle({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  return (
    <Reveal className="mb-8 max-w-2xl">
      {eyebrow && <p className="mb-2 text-xs font-bold uppercase tracking-[.2em] text-accent">{eyebrow}</p>}
      <h2 className="text-2xl font-extrabold tracking-tight sm:text-4xl">{title}</h2>
      {children && <p className="mt-3 text-white/65">{children}</p>}
    </Reveal>
  );
}

export function Welcome({ site }: { site: SiteData }) {
  const img = mediaUrl(site.welcome.imageId);
  if (!site.welcome.body) return null;
  return (
    <section className="mx-auto max-w-6xl px-5 py-16 sm:px-6">
      <Reveal>
        <div className={cn("glass grid gap-8 p-6 sm:p-10", img && "md:grid-cols-[.8fr_1.2fr] md:items-center")}>
          {img && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={img} alt="" className="aspect-[4/3] w-full rounded-2xl object-cover" />
          )}
          <div>
            <Quote className="mb-3 h-8 w-8 text-accent" />
            <h2 className="text-2xl font-extrabold sm:text-3xl">{site.welcome.heading}</h2>
            <p className="mt-4 whitespace-pre-line leading-relaxed text-white/70">{site.welcome.body}</p>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

export function MissionVision({ site }: { site: SiteData }) {
  const cards = [
    { icon: Target, title: "Our Mission", text: site.mission },
    { icon: Eye, title: "Our Vision", text: site.vision },
  ];
  return (
    <section className="mx-auto grid max-w-6xl gap-5 px-5 sm:px-6 md:grid-cols-2">
      {cards.map((c, i) => (
        <Reveal key={c.title} delay={i * 0.1}>
          <div className="glass glass-hover h-full p-7">
            <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-brand/20 text-brand"><c.icon className="h-6 w-6" /></div>
            <h3 className="text-xl font-bold">{c.title}</h3>
            <p className="mt-2 whitespace-pre-line leading-relaxed text-white/65">{c.text}</p>
          </div>
        </Reveal>
      ))}
    </section>
  );
}

export function Leaders({ site, limit }: { site: SiteData; limit?: number }) {
  const list = limit ? site.leaders.slice(0, limit) : site.leaders;
  if (!list.length) return null;
  return (
    <section className="mx-auto max-w-6xl px-5 py-16 sm:px-6">
      <SectionTitle eyebrow="Leadership" title="Meet the team serving you" />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {list.map((l, i) => {
          const img = mediaUrl(l.photoId);
          return (
            <Reveal key={i} delay={(i % 4) * 0.07}>
              <div className="glass glass-hover overflow-hidden p-0">
                <div className="aspect-[4/5] bg-gradient-to-br from-brand/20 to-accent/20">
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img} alt={l.name} className="h-full w-full object-cover transition duration-700 hover:scale-105" />
                  ) : (
                    <div className="grid h-full place-items-center text-5xl font-black text-white/65">{l.name.slice(0, 1)}</div>
                  )}
                </div>
                <div className="p-4">
                  <p className="font-bold">{l.name}</p>
                  <p className="text-xs font-medium text-accent">{l.role}</p>
                  {l.bio && <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-white/65">{l.bio}</p>}
                </div>
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}

export function Gallery({ site, limit }: { site: SiteData; limit?: number }) {
  const list = limit ? site.gallery.slice(0, limit) : site.gallery;
  const [zoom, setZoom] = useState<string | null>(null);
  if (!list.length) return null;
  return (
    <section className="mx-auto max-w-6xl px-5 py-16 sm:px-6">
      <SectionTitle eyebrow="Gallery" title="Moments we've shared" />
      <div className="columns-2 gap-4 sm:columns-3 [&>*]:mb-4">
        {list.map((g, i) => (
          <Reveal key={i} delay={(i % 6) * 0.05}>
            <button onClick={() => setZoom(g.imageId)} className="glass glass-hover group relative block w-full overflow-hidden p-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mediaUrl(g.imageId)} alt={g.caption} loading="lazy" className="w-full rounded-xl object-cover transition duration-700 group-hover:scale-[1.04]" />
              {g.caption && <span className="absolute inset-x-1.5 bottom-1.5 rounded-b-xl bg-gradient-to-t from-black/70 to-transparent p-3 pt-8 text-left text-xs">{g.caption}</span>}
            </button>
          </Reveal>
        ))}
      </div>
      <AnimatePresence>
        {zoom && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setZoom(null)} className="fixed inset-0 z-[90] grid place-items-center bg-black/80 p-4 backdrop-blur-md">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <motion.img initial={{ scale: 0.9 }} animate={{ scale: 1 }} src={mediaUrl(zoom)} alt="" className="max-h-[88vh] max-w-full rounded-2xl shadow-2xl" />
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

export function ContactBlock({ site }: { site: SiteData }) {
  const c = site.contact;
  const rows = [
    c.email && { icon: Mail, label: "Email", value: c.email, href: `mailto:${c.email}` },
    c.phone && { icon: Phone, label: "Phone", value: c.phone, href: `tel:${c.phone.replace(/\s/g, "")}` },
    c.address && { icon: MapPin, label: "Address", value: c.address },
    c.hours && { icon: Clock, label: "Hours", value: c.hours },
  ].filter(Boolean) as { icon: any; label: string; value: string; href?: string }[];
  return (
    <section className="mx-auto max-w-6xl px-5 py-16 sm:px-6">
      <SectionTitle eyebrow="Contact" title="We'd love to hear from you" />
      {rows.length === 0 ? (
        <p className="glass p-6 text-white/65">Contact details haven't been added yet.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {rows.map((r, i) => (
            <Reveal key={r.label} delay={i * 0.07}>
              {r.href ? (
                <a href={r.href} className="glass glass-hover flex items-center gap-4 p-5"><Row r={r} /></a>
              ) : (
                <div className="glass flex items-center gap-4 p-5"><Row r={r} /></div>
              )}
            </Reveal>
          ))}
        </div>
      )}
    </section>
  );
}
function Row({ r }: { r: { icon: any; label: string; value: string } }) {
  return (
    <>
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand/20 text-brand"><r.icon className="h-5 w-5" /></div>
      <div className="min-w-0"><p className="text-xs uppercase tracking-wider text-white/65">{r.label}</p><p className="break-words font-semibold">{r.value}</p></div>
    </>
  );
}

export function SiteFooter({ site }: { site: SiteData }) {
  const s = site.social;
  const socials = [
    s.facebook && { icon: Facebook, href: s.facebook, label: "Facebook" },
    s.instagram && { icon: Instagram, href: s.instagram, label: "Instagram" },
    s.youtube && { icon: Youtube, href: s.youtube, label: "YouTube" },
    s.x && { icon: X, href: s.x, label: "X" },
    s.whatsapp && { icon: MessageCircle, href: s.whatsapp, label: "WhatsApp" },
  ].filter(Boolean) as { icon: any; href: string; label: string }[];
  return (
    <footer className="mx-auto mt-10 max-w-6xl px-3 pb-6 sm:px-6">
      <div className="glass flex flex-col items-center justify-between gap-5 p-6 sm:flex-row">
        <div className="flex items-center gap-3"><Logo site={site} size={34} /><div><p className="text-sm font-bold">{site.brand.name}</p><p className="text-xs text-white/65">{site.footer.note || `© ${new Date().getFullYear()} ${site.brand.name}`}</p></div></div>
        <div className="flex gap-2">
          {socials.map((x) => (
            <a key={x.label} href={x.href} target="_blank" rel="noopener noreferrer" aria-label={x.label} className="btn btn-ghost !p-2.5 hover:!text-accent"><x.icon className="h-4 w-4" /></a>
          ))}
        </div>
      </div>
    </footer>
  );
}
