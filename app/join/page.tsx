import { getSite } from "@/lib/cms";
import { SimplePage } from "@/components/site/views";
import { SectionTitle } from "@/components/site/blocks";
import { JoinForm } from "@/components/site/JoinForm";
export const dynamic = "force-dynamic";
export const metadata = { title: "Join" };
export default async function Page() {
  const { site } = await getSite();
  return (<SimplePage site={site} current="/join"><section className="mx-auto max-w-3xl px-5 py-14 sm:px-6"><SectionTitle eyebrow="Join us" title="Create your member account">Get your member ID, a quick way to mark attendance, and your event tickets in one place.</SectionTitle><JoinForm /></section></SimplePage>);
}
