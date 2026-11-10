import { PageHeader } from "@/components/admin/AdminShell";
import { NotificationSettings } from "@/components/NotificationSettings";
import { ChangePassword } from "@/components/ChangePassword";
import { requirePageUser } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/roles";

export default async function Page() {
  const user = await requirePageUser();
  return (<><PageHeader title="My account" subtitle={`${user.name} · ${user.email} · ${ROLE_LABELS[user.role]}`} /><div className="space-y-5">
    {user.mustChange && <div className="max-w-md rounded-2xl border border-amber-400/40 bg-amber-500/10 p-4 text-sm text-amber-100"><b>Choose your own password.</b> You signed in with a temporary password. Set a new one now to continue. Nothing else is available until you do.</div>}
    {!user.mustChange && <NotificationSettings />}
    <ChangePassword forced={!!user.mustChange} />
  </div></>);
}
