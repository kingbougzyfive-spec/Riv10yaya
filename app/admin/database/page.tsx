import { PageHeader } from "@/components/admin/AdminShell";
import { DatabaseManager } from "@/components/admin/DatabaseManager";
import { requirePageUser } from "@/lib/auth";
import { PERMS } from "@/lib/rbac";

export default async function Page() {
  await requirePageUser(PERMS.database);
  return (
    <>
      <PageHeader title="Databases" subtitle="Add several MongoDB connection strings. If the active one goes down, the app switches to the next healthy backup automatically." />
      <DatabaseManager />
    </>
  );
}
