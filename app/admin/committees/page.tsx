import { PageHeader } from "@/components/admin/AdminShell";
import { GovernanceHub } from "@/components/admin/GovernanceHub";
import { requirePageUser } from "@/lib/auth";
import { can, PERMS } from "@/lib/rbac";
import { meScope } from "@/lib/reach";

export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await requirePageUser(PERMS.governance);
  return (<><PageHeader title="Committees" subtitle="Committees and their members, purpose and responsibilities." /><GovernanceHub tabs={["Committees"]} me={meScope(user)} canEdit={can(user.role, "governanceManage")} /></>);
}
