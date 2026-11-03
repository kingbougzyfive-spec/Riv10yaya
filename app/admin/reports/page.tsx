import { PageHeader } from "@/components/admin/AdminShell";
import { ReportsHub } from "@/components/admin/ReportsHub";
import { requirePageUser } from "@/lib/auth";
import { can, PERMS } from "@/lib/rbac";

export default async function Page() {
  const user = await requirePageUser(PERMS.reports);
  return (<><PageHeader title="Monthly reports" subtitle="Parish, area and zonal reports for each month, with consolidation, contact details and exports." /><ReportsHub canSubmit={can(user.role, "reportSubmit")} /></>);
}
