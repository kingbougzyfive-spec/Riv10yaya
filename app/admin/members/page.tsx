import { PageHeader } from "@/components/admin/AdminShell";
import { MembersManager } from "@/components/admin/MembersManager";
import { requirePageUser } from "@/lib/auth";
import { PERMS } from "@/lib/rbac";

export default async function Page() {
  const user = await requirePageUser(PERMS.members);
  return (<><PageHeader title="Members" subtitle="Members get a member ID they can use to mark attendance. Members never see each other's details." /><MembersManager role={user.role} /></>);
}
