import { PageHeader } from "@/components/admin/AdminShell";
import { FinanceDesk } from "@/components/admin/FinanceDesk";
export const dynamic = "force-dynamic";
export default function Page() {
  return (<><PageHeader title="Payment evidence" subtitle="See where each payment stands. If finance needs more detail, reply here or upload new evidence, and add part payments or levies." /><FinanceDesk role="parish_admin" /></>);
}
