import { PageHeader } from "@/components/admin/AdminShell";
import { AdminRequests } from "@/components/admin/AdminRequests";
import { requirePageUser } from "@/lib/auth";
import { PERMS } from "@/lib/rbac";

export const dynamic = "force-dynamic";
export default async function Page() {
  await requirePageUser(PERMS.users);
  return (
    <>
      <PageHeader title="Administrator requests" subtitle="Zone, area and parish leaders who registered themselves. Check each one is who they say, then approve. Approving creates their account and links it to their organisation." />
      <AdminRequests />
    </>
  );
}
