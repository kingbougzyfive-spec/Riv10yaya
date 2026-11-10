import { PageHeader } from "@/components/admin/AdminShell";
import { ReportWizard } from "@/components/admin/ReportWizard";
export const dynamic = "force-dynamic";
export default function Page() {
  return (<><PageHeader title="Monthly activity report" subtitle="Write NIL or enter 0 where there is nothing to report. Your report is never held back by payment verification." /><ReportWizard mode="report" /></>);
}
