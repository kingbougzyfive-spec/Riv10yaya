import { PageHeader } from "@/components/admin/AdminShell";
import { AttendanceManager } from "@/components/admin/AttendanceManager";
import { requirePageUser } from "@/lib/auth";
import { can, PERMS } from "@/lib/rbac";

export default async function Page() {
  const user = await requirePageUser(PERMS.attendanceView);
  return (<><PageHeader title="QR attendance" subtitle="Create a session, print the QR code, and watch attendance arrive live." /><AttendanceManager role={user.role} canCreate={can(user.role, "attendance")} /></>);
}
