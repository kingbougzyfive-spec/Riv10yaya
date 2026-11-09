import { PageHeader } from "@/components/admin/AdminShell";
import { ExportCenter } from "@/components/admin/ExportCenter";
import { requirePageUser } from "@/lib/auth";
import { exportsFor } from "@/lib/export/catalog";
import { PERMS } from "@/lib/rbac";

export default async function Page() {
  const user = await requirePageUser(PERMS.exportAny);
  const defs = exportsFor(user.role).map(({ roles: _r, ...d }) => d);
  return (<><PageHeader title="Reports & Exports" subtitle="Official reports as PDF, Excel or CSV. Choose a report, set the filters, check the preview, then download. You only ever get what your role is allowed to see." /><ExportCenter defs={defs} me={{ role: user.role, zone: user.zone, area: user.area, parish: user.parish }} /></>);
}
