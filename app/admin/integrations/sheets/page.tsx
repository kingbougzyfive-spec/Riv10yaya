import { PageHeader } from "@/components/admin/AdminShell";
import { SheetsSettings } from "@/components/admin/SheetsSettings";
import { requirePageUser } from "@/lib/auth";
import { PERMS } from "@/lib/rbac";

export default async function Page() {
  await requirePageUser(PERMS.integrations);
  return (<><PageHeader title="Google Sheets" subtitle="A read-only reporting copy for provincial leadership. The platform database stays the source of truth: nothing in the spreadsheet can change a record." /><SheetsSettings /></>);
}
