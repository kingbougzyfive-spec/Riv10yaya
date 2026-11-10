import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/ids";

export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/print", "/attendance", "/member", "/setup", "/login", "/reset-password"] }], sitemap: `${appUrl()}/sitemap.xml` };
}
