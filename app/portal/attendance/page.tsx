import { PageHeader } from "@/components/admin/AdminShell";
import { AttendanceManager } from "@/components/admin/AttendanceManager";
export const dynamic = "force-dynamic";
export default function Page() {
  return (<><PageHeader title="QR attendance" subtitle="Create a session for a service or programme, print the QR code, and watch attendance arrive live." /><AttendanceManager role="parish_admin" canCreate /></>);
}
