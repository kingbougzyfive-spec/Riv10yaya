import { PageHeader } from "@/components/admin/AdminShell";
import { FinanceDashboard } from "@/components/admin/FinanceDashboard";
import { requirePageUser } from "@/lib/auth";
import { PERMS } from "@/lib/rbac";

export default async function Page() {
  await requirePageUser(PERMS.finance);
  return (<><PageHeader title="Financial dashboard" subtitle="Every figure is calculated live from submitted and verified records. Only confirmed money counts as received." /><FinanceDashboard /></>);
}
