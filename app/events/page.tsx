import { getSite } from "@/lib/cms";
import { SimplePage } from "@/components/site/views";
import { SectionTitle } from "@/components/site/blocks";
import { EventsList } from "@/components/site/Events";
export const dynamic = "force-dynamic";
export const metadata = { title: "Events & Programmes" };
export default async function Page() {
  const { site } = await getSite();
  return (<SimplePage site={site} current="/events"><section className="mx-auto max-w-6xl px-5 py-14 sm:px-6"><SectionTitle eyebrow="Programmes" title="Upcoming events">Register online and get a QR ticket for easy check-in.</SectionTitle><EventsList /></section></SimplePage>);
}
