import { PageHeader } from "@/components/admin/AdminShell";
import { RegistrationsView } from "@/components/admin/RegistrationsView";
import { requirePageUser } from "@/lib/auth";
import { can, PERMS } from "@/lib/rbac";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const [user, { id }] = await Promise.all([requirePageUser(PERMS.attendanceView), params]);
  return (<><PageHeader title="Registrations" subtitle="Search, filter by zone, area or parish, check people in, and export." /><RegistrationsView eventId={id} canCheckIn={can(user.role, "attendance")} /></>);
}
