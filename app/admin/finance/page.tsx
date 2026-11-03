import { PageHeader } from "@/components/admin/AdminShell";
import { FinanceDesk } from "@/components/admin/FinanceDesk";
import { requirePageUser } from "@/lib/auth";
import { PERMS } from "@/lib/rbac";

export default async function Page() {
  const user = await requirePageUser(PERMS.finance);
  return (<><PageHeader title="Finance" subtitle="Each parish pays its own remittance directly into the provincial account. Areas and zones only monitor; nothing is counted twice." /><FinanceDesk role={user.role} /></>);
}
