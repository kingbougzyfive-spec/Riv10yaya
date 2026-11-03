import { PageHeader } from "@/components/admin/AdminShell";
import { ReportWizard } from "@/components/admin/ReportWizard";
import { requirePageUser } from "@/lib/auth";
import { PERMS } from "@/lib/rbac";

export default async function Page() {
  await requirePageUser(PERMS.reportSubmit);
  return (<><PageHeader title="Monthly report" subtitle="Your zone, area and parish are filled in automatically from the system. Fields marked * are required; write NIL or enter 0 where there is nothing to report." /><ReportWizard /></>);
}
