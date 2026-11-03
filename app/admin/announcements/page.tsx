import { PageHeader } from "@/components/admin/AdminShell";
import { ContentManager } from "@/components/admin/ContentManager";
import { requirePageUser } from "@/lib/auth";
import { PERMS } from "@/lib/rbac";

export default async function Page() {
  await requirePageUser(PERMS.content);
  return (<><PageHeader title="Announcements" subtitle="News and notices for the public website. Pinned items appear first." /><ContentManager kind="announcements" /></>);
}
