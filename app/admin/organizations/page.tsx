import { PageHeader } from "@/components/admin/AdminShell";
import { OrgManager } from "@/components/admin/OrgManager";
import { requirePageUser } from "@/lib/auth";
import { can, PERMS } from "@/lib/rbac";

export default async function Page() {
  const user = await requirePageUser(PERMS.orgView);
  return (
    <>
      <PageHeader title="Organisation" subtitle="Zones can have areas, or be standalone with parishes directly under them. Every parish sits on exactly one path." />
      <OrgManager canManage={can(user.role, "orgManage")} />
    </>
  );
}
