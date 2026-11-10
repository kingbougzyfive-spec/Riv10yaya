import { PageHeader } from "@/components/admin/AdminShell";
import { SettingsHub } from "@/components/admin/SettingsHub";
import { PERMS } from "@/lib/rbac";
import { requirePageUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await requirePageUser(PERMS.adminArea);
  return (<><PageHeader title="Settings" subtitle="Reporting periods, roles and shortcuts to the other settings pages." /><SettingsHub canPeriods={["super_admin", "provincial_admin", "finance_admin"].includes(user.role)} canCatalog={["super_admin", "auditor"].includes(user.role)} /></>);
}
