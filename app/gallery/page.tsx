import { getSite } from "@/lib/cms";
import { SimplePage } from "@/components/site/views";
import { Gallery } from "@/components/site/blocks";
export const dynamic = "force-dynamic";
export const metadata = { title: "Gallery" };
export default async function Page() {
  const { site } = await getSite();
  return (
    <SimplePage site={site} current="/gallery">
      <div className="pt-8">{site.gallery.length ? <Gallery site={site} /> : <p className="mx-auto max-w-6xl px-6 py-20 text-white/65">Photos will appear here soon.</p>}</div>
    </SimplePage>
  );
}
