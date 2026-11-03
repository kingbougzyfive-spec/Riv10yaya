import { PageHeader } from "@/components/admin/AdminShell";
import { ContentManager } from "@/components/admin/ContentManager";
import { requirePageUser } from "@/lib/auth";
import { PERMS } from "@/lib/rbac";

export default async function Page() {
  await requirePageUser(PERMS.content);
  return (<><PageHeader title="Departments" subtitle="Departments shown on the public Departments page." /><ContentManager kind="departments" /></>);
}
