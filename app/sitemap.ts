import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/ids";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = appUrl();
  const fixed = ["", "/about", "/leadership", "/zones", "/structure", "/events", "/announcements", "/departments", "/gallery", "/contact", "/install", "/join"].map((p) => ({ url: base + p, changeFrequency: "weekly" as const }));
  try {
    const { Event } = await getDb();
    const ev = await Event.find({ status: "published" }, { updatedAt: 1, slug: 1 }).limit(500).lean<any[]>();
    return [...fixed, ...ev.map((e) => ({ url: `${base}/events/${e.slug ?? e._id}`, lastModified: e.updatedAt }))];
  } catch { return fixed; }
}
