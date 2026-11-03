import { getSite } from "@/lib/cms";
import { SimplePage } from "@/components/site/views";
import { Leaders } from "@/components/site/blocks";
export const dynamic = "force-dynamic";
export const metadata = { title: "Leadership" };
export default async function Page() {
  const { site } = await getSite();
  return (
    <SimplePage site={site} current="/leadership">
      <div className="pt-8">{site.leaders.length ? <Leaders site={site} /> : <p className="mx-auto max-w-6xl px-6 py-20 text-white/55">Leadership profiles are coming soon.</p>}</div>
    </SimplePage>
  );
}
