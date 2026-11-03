import { AdminShell } from "@/components/admin/AdminShell";
import { getSite } from "@/lib/cms";
import { requirePageUser } from "@/lib/auth";
import { PERMS } from "@/lib/rbac";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin" };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser(PERMS.adminArea);
  const { site } = await getSite();
  return <AdminShell user={{ name: user.name, role: user.role }} brand={site.brand.shortName || site.brand.name}>{children}</AdminShell>;
}
