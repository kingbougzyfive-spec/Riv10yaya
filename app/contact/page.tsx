import { getSite } from "@/lib/cms";
import { SimplePage } from "@/components/site/views";
import { ContactBlock } from "@/components/site/blocks";
export const dynamic = "force-dynamic";
export const metadata = { title: "Contact" };
export default async function Page() {
  const { site } = await getSite();
  return <SimplePage site={site} current="/contact"><div className="pt-8"><ContactBlock site={site} /></div></SimplePage>;
}
