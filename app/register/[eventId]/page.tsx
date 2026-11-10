import { getSite } from "@/lib/cms";
import { SimplePage } from "@/components/site/views";
import { EventDetail } from "@/components/site/Events";

export const dynamic = "force-dynamic";
export const metadata = { title: "Register" };

/** Direct link to an event's registration form. `eventId` is the event's address name (or its older id). */
export default async function Page({ params }: { params: Promise<{ eventId: string }> }) {
  const [{ site }, { eventId }] = await Promise.all([getSite(), params]);
  return (<SimplePage site={site} current="/events"><section className="mx-auto max-w-6xl px-5 py-12 sm:px-6"><EventDetail id={eventId} scrollToRegister /></section></SimplePage>);
}
