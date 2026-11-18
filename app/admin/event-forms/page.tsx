import { EventForms } from "@/components/admin/EventForms";
import { PageHeader } from "@/components/admin/AdminShell";
import { requirePageUser } from "@/lib/auth";
import { PERMS } from "@/lib/rbac";

export const dynamic = "force-dynamic";
export default async function Page() {
  await requirePageUser(PERMS.eventForms);
  return (
    <>
      <PageHeader title="Event record forms" subtitle="Create a form for a special event so every parish, area or zone records the same things: males, females, the total and the offering. This is separate from the monthly remittance and report." />
      <EventForms />
    </>
  );
}
