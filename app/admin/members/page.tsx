import { PageHeader } from "@/components/admin/AdminShell";
import { MembersManager } from "@/components/admin/MembersManager";
import { requirePageUser } from "@/lib/auth";
import { PERMS } from "@/lib/rbac";

export default async function Page() {
  const user = await requirePageUser(PERMS.members);
  return (<><PageHeader title="Members" subtitle="Register, update and follow up members in your own parish, area or zone. Under-18 details are protected, and every important change is logged." /><MembersManager role={user.role} /></>);
}
