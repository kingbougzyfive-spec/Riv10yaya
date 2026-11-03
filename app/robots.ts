import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/ids";

export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/print", "/attend", "/me", "/setup", "/login", "/reset"] }], sitemap: `${appUrl()}/sitemap.xml` };
}
