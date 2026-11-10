import { PageHeader } from "@/components/admin/AdminShell";
import { AuditViewer } from "@/components/admin/AuditViewer";
import { requirePageUser } from "@/lib/auth";
import { PERMS } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requirePageUser(PERMS.audit);
  return (
    <>
      <PageHeader title="Audit Log" subtitle="A permanent record of who did what, to which record, and when. Entries can't be edited or deleted from the app." />
      <AuditViewer />
    </>
  );
}
