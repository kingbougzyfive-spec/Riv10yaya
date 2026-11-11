import { PageHeader } from "@/components/admin/AdminShell";
import { CommsHub } from "@/components/admin/CommsHub";
import { requirePageUser } from "@/lib/auth";
import { PERMS } from "@/lib/rbac";
import { mailConfigured } from "@/lib/mail";
import { pushConfigured } from "@/lib/push";

export default async function Page() {
  const user = await requirePageUser(PERMS.comms);
  return (<><PageHeader title="Communications" subtitle="Send announcements and notices to the people you're responsible for, see exactly what was delivered, and manage automatic reminders." /><CommsHub avail={{ email: mailConfigured(), push: pushConfigured() }} me={{ role: user.role, zone: user.zone, area: user.area, parish: user.parish }} /></>);
}
