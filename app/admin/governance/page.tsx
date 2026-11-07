import { PageHeader } from "@/components/admin/AdminShell";
import { GovernanceHub } from "@/components/admin/GovernanceHub";
import { requirePageUser } from "@/lib/auth";
import { can, PERMS } from "@/lib/rbac";

export default async function Page() {
  const user = await requirePageUser(PERMS.governance);
  return (<><PageHeader title="Leadership & committees" subtitle="Appointments, departments, committees, tasks, meetings and documents, each tied to its own level. You manage your own level and the ones below it." /><GovernanceHub me={{ role: user.role, zone: user.zone, area: user.area, parish: user.parish }} canEdit={can(user.role, "governanceManage")} /></>);
}
