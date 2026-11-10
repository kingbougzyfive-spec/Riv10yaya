import { PageHeader } from "@/components/admin/AdminShell";
import { GovernanceHub } from "@/components/admin/GovernanceHub";
import { requirePageUser } from "@/lib/auth";
import { can, PERMS } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await requirePageUser(PERMS.governance);
  return (<><PageHeader title="Tasks" subtitle="Tasks assigned to members, committees and departments, with due dates and updates." /><GovernanceHub tabs={["Tasks"]} me={{ role: user.role, zone: user.zone, area: user.area, parish: user.parish }} canEdit={can(user.role, "governanceManage")} /></>);
}
