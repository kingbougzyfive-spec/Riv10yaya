import { getSite } from "@/lib/cms";
import { SimplePage } from "@/components/site/views";
import { Ticket } from "@/components/site/Events";
export const dynamic = "force-dynamic";
export const metadata = { title: "Your ticket" };
export default async function Page({ params }: { params: Promise<{ slug: string; ref: string }> }) {
  const [{ site }, { slug: id, ref }] = await Promise.all([getSite(), params]);
  return (<SimplePage site={site} current="/events"><section className="px-5 py-12"><Ticket eventId={id} refCode={ref} /></section></SimplePage>);
}
