import { PageHeader } from "@/components/admin/AdminShell";
import { SessionDetail } from "@/components/admin/SessionDetail";
import { requirePageUser } from "@/lib/auth";
import { can, PERMS } from "@/lib/rbac";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const [user, { id }] = await Promise.all([requirePageUser(PERMS.attendanceView), params]);
  return (<><PageHeader title="Attendance session" /><SessionDetail id={id} canManage={can(user.role, "attendance")} /></>);
}
