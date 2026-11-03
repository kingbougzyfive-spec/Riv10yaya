import { getSite } from "@/lib/cms";
import { AboutView } from "@/components/site/views";
export const dynamic = "force-dynamic";
export const metadata = { title: "About us" };
export default async function Page() {
  const { site } = await getSite();
  return <AboutView site={site} />;
}
