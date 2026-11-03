import { getSite } from "@/lib/cms";
import { SimplePage } from "@/components/site/views";
import { SectionTitle } from "@/components/site/blocks";
import { InstallPanel } from "@/components/InstallButton";
export const dynamic = "force-dynamic";
export const metadata = { title: "Install App" };
export default async function Page() {
  const { site } = await getSite();
  return (
    <SimplePage site={site} current="/install">
      <section className="mx-auto max-w-3xl px-5 py-14 sm:px-6">
        <SectionTitle eyebrow="Install" title={`Get ${site.brand.shortName || site.brand.name} on your phone`}>Works like a normal app: its own icon, full-screen, fast to open.</SectionTitle>
        <InstallPanel />
      </section>
    </SimplePage>
  );
}
