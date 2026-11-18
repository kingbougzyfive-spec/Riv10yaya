import { EventRecords } from "@/components/admin/EventRecords";
import { PageHeader } from "@/components/admin/AdminShell";
import { requirePageUser } from "@/lib/auth";
import { PERMS } from "@/lib/rbac";

export const dynamic = "force-dynamic";
export default async function Page() {
  const user = await requirePageUser(PERMS.eventRecords);
  return (
    <>
      <PageHeader title="Event records" subtitle="For each special event: how many males and females came, the total (worked out for you) and the offering collected. Record the units in your care and watch the totals add up." />
      <EventRecords role={user.role} />
    </>
  );
}
