import { PageHeader } from "@/components/admin/AdminShell";
import { IntegrationsPanel } from "@/components/admin/IntegrationsPanel";
import { requirePageUser } from "@/lib/auth";
import { PERMS } from "@/lib/rbac";

export default async function Page() {
  const user = await requirePageUser(PERMS.integrations);
  return (<><PageHeader title="Integrations" subtitle="See what's connected and what still needs a key. Nothing is shown as active unless its credentials are really present." /><IntegrationsPanel role={user.role} /></>);
}
