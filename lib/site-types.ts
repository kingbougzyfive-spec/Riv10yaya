import { z } from "zod";

/** Client-safe: types, defaults, validation and theme helpers for CMS content. */

const str = (max = 400) => z.string().max(max).default("");
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a colour like #10b981");

export const siteSchema = z.object({
  brand: z.object({
    name: z.string().min(2).max(80),
    shortName: str(30),
    tagline: str(160),
    logoId: str(40),
    primary: hex,
    accent: hex,
  }),
  hero: z.object({
    badge: str(80),
    title: z.string().min(2).max(140),
    subtitle: str(400),
    ctaText: str(40),
    ctaLink: str(200),
    secondaryText: str(40),
    secondaryLink: str(200),
    imageId: str(40),
  }),
  welcome: z.object({ heading: str(120), body: str(2000), imageId: str(40) }),
  mission: str(1200),
  vision: str(1200),
  about: z.object({ heading: str(120), body: str(6000), imageId: str(40) }),
  stats: z.array(z.object({ label: str(40), value: str(20) })).max(8),
  leaders: z
    .array(z.object({ name: z.string().min(1).max(80), role: str(80), bio: str(600), photoId: str(40) }))
    .max(40),
  gallery: z.array(z.object({ imageId: z.string().min(1).max(40), caption: str(160) })).max(60),
  contact: z.object({ email: str(120), phone: str(40), address: str(240), hours: str(160) }),
  social: z.object({ facebook: str(200), instagram: str(200), youtube: str(200), x: str(200), whatsapp: str(200) }),
  footer: z.object({ note: str(240) }),
  sections: z.object({ stats: z.boolean(), leadership: z.boolean(), gallery: z.boolean(), contact: z.boolean() }),
});

export type SiteData = z.infer<typeof siteSchema>;

export const defaultSite: SiteData = {
  brand: {
    name: "RCCG Rivers 10 YAYA",
    shortName: "Rivers 10 YAYA",
    tagline: "Young Adults and Youth Affairs",
    logoId: "",
    primary: "#10b981",
    accent: "#f5b942",
  },
  hero: {
    badge: "Welcome to our family",
    title: "Raising a generation that is rooted, radiant and ready.",
    subtitle:
      "RCCG Rivers 10 Young Adults and Youth Affairs brings zones, areas and parishes together to grow in faith, fellowship and purpose.",
    ctaText: "Explore programmes",
    ctaLink: "/about",
    secondaryText: "Install the app",
    secondaryLink: "/install",
    imageId: "",
  },
  welcome: {
    heading: "A message of welcome",
    body: "Edit this message from Admin → Site Editor. Share a warm welcome with visitors and tell them what to expect.",
    imageId: "",
  },
  mission: "Edit your mission statement from the Site Editor.",
  vision: "Edit your vision statement from the Site Editor.",
  about: { heading: "About us", body: "Tell your story here from Admin → Site Editor → About.", imageId: "" },
  stats: [
    { label: "Zones", value: "—" },
    { label: "Areas", value: "—" },
    { label: "Parishes", value: "—" },
  ],
  leaders: [],
  gallery: [],
  contact: { email: "", phone: "", address: "", hours: "" },
  social: { facebook: "", instagram: "", youtube: "", x: "", whatsapp: "" },
  footer: { note: "" },
  sections: { stats: true, leadership: true, gallery: true, contact: true },
};

export function mergeSite(stored: Partial<SiteData> | undefined | null): SiteData {
  const out: any = structuredClone(defaultSite);
  if (!stored) return out;
  for (const k of Object.keys(out)) {
    const v = (stored as any)[k];
    if (v === undefined || v === null) continue;
    if (Array.isArray(out[k]) || typeof out[k] !== "object") out[k] = v;
    else out[k] = { ...out[k], ...v };
  }
  return out;
}

export function hexToRgb(h: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(h);
  if (!m) return "16 185 129";
  const n = parseInt(m[1], 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

export function themeVars(site: SiteData): Record<string, string> {
  return { "--brand": hexToRgb(site.brand.primary), "--accent": hexToRgb(site.brand.accent) };
}

export const mediaUrl = (id?: string) => (id ? `/api/media/${id}` : "");
