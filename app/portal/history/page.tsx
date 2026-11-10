import { PageHeader } from "@/components/admin/AdminShell";
import { ReportsHub } from "@/components/admin/ReportsHub";
export const dynamic = "force-dynamic";
export default function Page() {
  return (<><PageHeader title="History" subtitle="Your submitted reports month by month, including any revisions that were requested." /><ReportsHub canSubmit /></>);
}
