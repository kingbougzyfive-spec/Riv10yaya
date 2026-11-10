import { PageHeader } from "@/components/admin/AdminShell";
import { SecurityCenter } from "@/components/admin/SecurityCenter";
import { requirePageUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requirePageUser(["super_admin"]);
  return (<><PageHeader title="Security" subtitle="Deployment checklist, backups and server errors. Secret values are never shown." /><SecurityCenter /></>);
}
