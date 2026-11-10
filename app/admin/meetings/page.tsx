import { PageHeader } from "@/components/admin/AdminShell";
import { GovernanceHub } from "@/components/admin/GovernanceHub";
import { requirePageUser } from "@/lib/auth";
import { can, PERMS } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await requirePageUser(PERMS.governance);
  return (<><PageHeader title="Meetings" subtitle="Meetings, agendas, minutes and action points." /><GovernanceHub tabs={["Meetings"]} me={{ role: user.role, zone: user.zone, area: user.area, parish: user.parish }} canEdit={can(user.role, "governanceManage")} /></>);
}
