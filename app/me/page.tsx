import { redirect } from "next/navigation";
import { getSite } from "@/lib/cms";
import { getUser } from "@/lib/auth";
import { SimplePage } from "@/components/site/views";
import { MemberPortal } from "@/components/site/MemberPortal";
export const dynamic = "force-dynamic";
export const metadata = { title: "My account" };
export default async function Page() {
  const user = await getUser();
  if (!user) redirect("/login");
  if (user.role !== "member") redirect("/admin");
  const { site } = await getSite();
  return (<SimplePage site={site} current="/me"><section className="px-5 py-12 sm:px-6"><MemberPortal /></section></SimplePage>);
}
