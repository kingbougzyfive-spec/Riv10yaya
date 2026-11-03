import { getSite } from "@/lib/cms";
import { SimplePage } from "@/components/site/views";
import { SectionTitle } from "@/components/site/blocks";
import { AnnouncementsList } from "@/components/site/Lists";
import { PushToggle } from "@/components/PushToggle";
export const dynamic = "force-dynamic";
export const metadata = { title: "Announcements" };
export default async function Page() {
  const { site } = await getSite();
  return (<SimplePage site={site} current="/announcements"><section className="mx-auto max-w-6xl px-5 py-14 sm:px-6"><SectionTitle eyebrow="News" title="Announcements" /><div className="mb-8"><PushToggle /></div><AnnouncementsList /></section></SimplePage>);
}
