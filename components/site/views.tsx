"use client";
import type { ReactNode } from "react";
import type { SiteData } from "@/lib/site-types";
import { mediaUrl } from "@/lib/site-types";
import { ContactBlock, Gallery, Hero, Leaders, MissionVision, SectionTitle, SiteFooter, SiteNav, Stats, Welcome } from "./blocks";
import { Reveal } from "@/components/ui/Reveal";
import { AnnouncementsList } from "./Lists";

export type Counts = { zones: number; areas: number; parishes: number } | null;

/** Wraps a page; in preview mode navigation is disabled so editors can safely click around. */
export function Frame({ site, current, preview, children }: { site: SiteData; current: string; preview?: boolean; children: ReactNode }) {
  return (
    <div
      onClickCapture={(e) => {
        if (preview && (e.target as HTMLElement).closest("a")) e.preventDefault();
      }}
    >
      <SiteNav site={site} current={current} />
      <main>{children}</main>
      <SiteFooter site={site} />
    </div>
  );
}

/** The home page. The same component renders the live site and the editor's preview. */
export function HomeView({ site, counts, preview }: { site: SiteData; counts?: Counts; preview?: boolean }) {
  return (
    <Frame site={site} current="/" preview={preview}>
      <Hero site={site} />
      {site.sections.stats && <Stats site={site} live={counts} />}
      <Welcome site={site} />
      <MissionVision site={site} />
      {!preview && <section className="mx-auto max-w-6xl px-5 pt-16 sm:px-6"><SectionTitle eyebrow="News" title="Latest announcements" /><AnnouncementsList limit={2} /></section>}
      {site.sections.leadership && <Leaders site={site} limit={4} />}
      {site.sections.gallery && <Gallery site={site} limit={6} />}
      {site.sections.contact && <ContactBlock site={site} />}
    </Frame>
  );
}

export function AboutView({ site }: { site: SiteData }) {
  const img = mediaUrl(site.about.imageId);
  return (
    <Frame site={site} current="/about">
      <section className="mx-auto max-w-6xl px-5 pt-14 sm:px-6">
        <SectionTitle eyebrow="About us" title={site.about.heading || "About us"} />
        <Reveal>
          <div className="glass grid gap-8 p-6 sm:p-10 md:grid-cols-2">
            <p className="whitespace-pre-line leading-relaxed text-white/70">{site.about.body}</p>
            {img ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={img} alt="" className="w-full rounded-2xl object-cover" />
            ) : null}
          </div>
        </Reveal>
      </section>
      <div className="mt-12"><MissionVision site={site} /></div>
    </Frame>
  );
}

export function SimplePage({ site, current, children }: { site: SiteData; current: string; children: ReactNode }) {
  return <Frame site={site} current={current}>{children}</Frame>;
}

export function ZonesView({ site, zones }: { site: SiteData; zones: { id: string; name: string; hasAreas: boolean; areas: { id: string; name: string; parishes: string[] }[]; parishes: string[] }[] }) {
  return (
    <Frame site={site} current="/zones">
      <section className="mx-auto max-w-6xl px-5 py-14 sm:px-6">
        <SectionTitle eyebrow="Structure" title="Zones, areas and parishes">Our family is organised into zones. Some zones have areas; others have parishes directly under them.</SectionTitle>
        {zones.length === 0 && <p className="glass p-6 text-white/55">No zones have been published yet.</p>}
        <div className="grid gap-5 md:grid-cols-2">
          {zones.map((z, i) => (
            <Reveal key={z.id} delay={(i % 2) * 0.08}>
              <div className="glass glass-hover h-full p-6">
                <div className="flex items-center justify-between gap-3"><h3 className="text-lg font-bold">{z.name}</h3><span className="badge">{z.hasAreas ? "With areas" : "Standalone"}</span></div>
                {z.hasAreas ? (
                  <ul className="mt-4 space-y-3">
                    {z.areas.map((a) => (
                      <li key={a.id}><p className="text-sm font-semibold text-accent">{a.name}</p><p className="text-xs text-white/55">{a.parishes.length ? a.parishes.join(" • ") : "No parishes yet"}</p></li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-4 text-sm text-white/65">{z.parishes.length ? z.parishes.join(" • ") : "No parishes yet"}</p>
                )}
              </div>
            </Reveal>
          ))}
        </div>
      </section>
    </Frame>
  );
}
