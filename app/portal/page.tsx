import { PageHeader } from "@/components/admin/AdminShell";
import { PortalHome } from "@/components/portal/PortalHome";
import { requirePageUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await requirePageUser(["parish_admin"]);
  const { Parish } = await getDb();
  const first = user.parishes[0] ?? user.parish;
  const parish = first ? await Parish.findById(first, { name: 1 }).lean<any>() : null;
  return (<><PageHeader title={`Welcome, ${user.name.split(" ")[0]}`} subtitle="Your parish's remittance, monthly report and attendance in one place." /><PortalHome parish={parish?.name ?? "Your parish"} /></>);
}
