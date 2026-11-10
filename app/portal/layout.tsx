import { redirect } from "next/navigation";
import { PortalShell } from "@/components/portal/PortalShell";
import { getSite } from "@/lib/cms";
import { requirePageUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Parish portal" };

/** Parish administrators only. Anyone else is sent to the area meant for them. */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser();
  if (user.role !== "parish_admin") redirect(user.role === "member" ? "/member" : "/admin");
  const { site } = await getSite();
  return <PortalShell user={{ name: user.name, role: user.role }} brand={site.brand.shortName || site.brand.name}>{children}</PortalShell>;
}
