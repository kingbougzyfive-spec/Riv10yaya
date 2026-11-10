import { PageHeader } from "@/components/admin/AdminShell";
import { RegistrationsHub } from "@/components/admin/RegistrationsHub";
import { can, PERMS } from "@/lib/rbac";
import { requirePageUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await requirePageUser(PERMS.attendanceView);
  return (<><PageHeader title="Registrations" subtitle="Choose an event, then search, filter by zone, area or parish, check people in, and export." /><RegistrationsHub canCheckIn={can(user.role, "attendance")} /></>);
}
