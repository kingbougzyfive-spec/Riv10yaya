import { PageHeader } from "@/components/admin/AdminShell";
import { NotificationsList } from "@/components/NotificationsList";
export const dynamic = "force-dynamic";
export default function Page() {
  return (<><PageHeader title="Notifications" subtitle="Messages about your payments, reports and parish." /><NotificationsList /></>);
}
