import { PageHeader } from "@/components/admin/AdminShell";
import { EventsManager } from "@/components/admin/EventsManager";
import { requirePageUser } from "@/lib/auth";
import { can, PERMS } from "@/lib/rbac";

export default async function Page() {
  const user = await requirePageUser(PERMS.attendanceView);
  return (<><PageHeader title="Events & programmes" subtitle="Create events, publish them to the website, and watch registrations come in." /><EventsManager canManage={can(user.role, "events")} /></>);
}
