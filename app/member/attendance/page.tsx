import { redirect } from "next/navigation";
import { getSite } from "@/lib/cms";
import { getUser } from "@/lib/auth";
import { SimplePage } from "@/components/site/views";
import { MemberPortal } from "@/components/site/MemberPortal";
export const dynamic = "force-dynamic";
export const metadata = { title: "My attendance" };
export default async function Page() {
  const user = await getUser();
  if (!user) redirect("/login");
  if (user.role !== "member") redirect(user.role === "parish_admin" ? "/portal" : "/admin");
  const { site } = await getSite();
  return (<SimplePage site={site} current="/member"><section className="px-5 py-12 sm:px-6"><MemberPortal view="attendance" /></section></SimplePage>);
}
