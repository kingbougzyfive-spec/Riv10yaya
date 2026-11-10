import type { MetadataRoute } from "next";
import { getSite } from "@/lib/cms";

export const dynamic = "force-dynamic";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const { site } = await getSite();
  return {
    name: site.brand.name,
    short_name: site.brand.shortName || site.brand.name,
    description: site.brand.tagline,
    id: "/",
    lang: "en-NG",
    dir: "ltr",
    categories: ["religion", "lifestyle", "social"],
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    background_color: "#070b14",
    theme_color: site.brand.primary,
    orientation: "any",
    shortcuts: [
      { name: "Events", short_name: "Events", url: "/events?source=shortcut", icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }] },
      { name: "Announcements", short_name: "News", url: "/announcements?source=shortcut", icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }] },
      { name: "My account", short_name: "Me", url: "/me?source=shortcut", icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }] },
    ],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
