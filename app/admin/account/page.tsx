import { PageHeader } from "@/components/admin/AdminShell";
import { NotificationSettings } from "@/components/NotificationSettings";
import { ChangePassword } from "@/components/ChangePassword";
import { requirePageUser } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/roles";

export default async function Page() {
  const user = await requirePageUser();
  return (<><PageHeader title="My account" subtitle={`${user.name} · ${user.email} · ${ROLE_LABELS[user.role]}`} /><div className="space-y-5"><NotificationSettings /><ChangePassword /></div></>);
}
