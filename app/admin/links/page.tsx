import { FillLinks } from "@/components/admin/FillLinks";
import { PageHeader } from "@/components/admin/AdminShell";
import { requirePageUser } from "@/lib/auth";
import { PERMS } from "@/lib/rbac";

export const dynamic = "force-dynamic";
export default async function Page() {
  const user = await requirePageUser(PERMS.fillLinks);
  return (
    <>
      <PageHeader title="Fill-in links" subtitle="Give someone a private link to fill in a parish's monthly report and remittance, or an event record, for a unit you are in charge of. They also need the password you give them, so the link alone opens nothing." />
      <FillLinks role={user.role} />
    </>
  );
}
