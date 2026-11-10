import { getSite } from "@/lib/cms";
import { SimplePage } from "@/components/site/views";
import { EventDetail } from "@/components/site/Events";
export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const [{ site }, { slug: id }] = await Promise.all([getSite(), params]);
  return (<SimplePage site={site} current="/events"><section className="mx-auto max-w-6xl px-5 py-12 sm:px-6"><EventDetail id={id} /></section></SimplePage>);
}
