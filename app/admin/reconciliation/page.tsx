import { PageHeader } from "@/components/admin/AdminShell";
import { ReconciliationView } from "@/components/admin/ReconciliationView";
import { PERMS } from "@/lib/rbac";
import { requirePageUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await requirePageUser(PERMS.finance);
  return (<><PageHeader title="Bank reconciliation" subtitle="Each payment against the bank statement. Only confirmed payments count as received." /><ReconciliationView canFix={(PERMS.financeReview as readonly string[]).includes(user.role)} /></>);
}
