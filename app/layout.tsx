import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Aurora } from "@/components/ui/Aurora";
import { ToastProvider } from "@/components/ui/Toast";
import { ConfirmProvider } from "@/components/ui/ConfirmDialog";
import { SwRegister } from "@/components/SwRegister";
import { getSite } from "@/lib/cms";
import { themeVars } from "@/lib/site-types";
import { SPLASH } from "@/lib/splash";
import { OfflineBanner } from "@/components/pwa/OfflineBanner";
import { UpdateToast } from "@/components/pwa/UpdateToast";

export async function generateMetadata(): Promise<Metadata> {
  const { site } = await getSite();
  return {
    title: { default: site.brand.name, template: `%s · ${site.brand.shortName || site.brand.name}` },
    description: site.hero.subtitle || site.brand.tagline,
    applicationName: site.brand.name,
    appleWebApp: { capable: true, title: site.brand.shortName || site.brand.name, statusBarStyle: "black-translucent", startupImage: SPLASH.map((s) => ({ url: s.src, media: s.media })) },
    formatDetection: { telephone: false },
    other: { "mobile-web-app-capable": "yes" },
    icons: { icon: "/icons/icon.svg", apple: "/icons/apple-touch-icon.png" },
  };
}

export const viewport: Viewport = { themeColor: "#070b14", width: "device-width", initialScale: 1, viewportFit: "cover" };

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { site } = await getSite();
  return (
    <html lang="en" style={themeVars(site) as React.CSSProperties} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem("yaya-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}` }} /></head>
      <body>
        <a href="#content" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[200] focus:rounded-xl focus:bg-brand focus:px-4 focus:py-2 focus:font-bold focus:text-[#04130d]">Skip to content</a>
        <Aurora />
        <ToastProvider><ConfirmProvider>{children}</ConfirmProvider></ToastProvider>
        <SwRegister />
        <OfflineBanner />
        <UpdateToast />
      </body>
    </html>
  );
}
