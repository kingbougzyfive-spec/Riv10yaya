import { PageHeader } from "@/components/admin/AdminShell";
import { ReportWizard } from "@/components/admin/ReportWizard";
export const dynamic = "force-dynamic";
export default function Page() {
  return (<><PageHeader title="Youth Sunday remittance" subtitle="Enter the offering, pay into the official provincial account, and upload your receipt. Finance then verifies it against the bank statement." /><ReportWizard mode="remittance" /></>);
}
