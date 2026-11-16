import { PageHeader } from "@/components/admin/AdminShell";
import { GovernanceHub } from "@/components/admin/GovernanceHub";
import { requirePageUser } from "@/lib/auth";
import { can, PERMS } from "@/lib/rbac";
import { meScope } from "@/lib/reach";

export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await requirePageUser(PERMS.governance);
  return (<><PageHeader title="Meetings" subtitle="Meetings, agendas, minutes and action points." /><GovernanceHub tabs={["Meetings"]} me={meScope(user)} canEdit={can(user.role, "governanceManage")} /></>);
}
