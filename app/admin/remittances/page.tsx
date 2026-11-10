import { PageHeader } from "@/components/admin/AdminShell";
import { RemittanceTracker } from "@/components/admin/RemittanceTracker";
import { PERMS } from "@/lib/rbac";
import { requirePageUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await requirePageUser(PERMS.finance);
  return (<><PageHeader title="Remittances" subtitle="Which parishes have submitted their Youth Sunday remittance this month, and where each one stands." /><RemittanceTracker /></>);
}
