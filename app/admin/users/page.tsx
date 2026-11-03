import { PageHeader } from "@/components/admin/AdminShell";
import { UsersManager } from "@/components/admin/UsersManager";
import { requirePageUser } from "@/lib/auth";
import { PERMS } from "@/lib/rbac";

export default async function Page() {
  const user = await requirePageUser(PERMS.users);
  return (
    <>
      <PageHeader title="Users & Roles" subtitle="Create administrators and assign each one to the zone, area or parish they are responsible for. Permissions are enforced on the server." />
      <UsersManager meId={user.id} />
    </>
  );
}
