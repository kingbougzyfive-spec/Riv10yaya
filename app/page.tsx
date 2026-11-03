import { redirect } from "next/navigation";
import { getOrgCounts, getSite } from "@/lib/cms";
import { isDatabaseConfigured } from "@/lib/db";
import { HomeView } from "@/components/site/views";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (!isDatabaseConfigured()) redirect("/setup");
  const [{ site }, counts] = await Promise.all([getSite(), getOrgCounts()]);
  return <HomeView site={site} counts={counts} />;
}
