import { PageHeader } from "@/components/admin/AdminShell";
import { SiteEditor } from "@/components/admin/SiteEditor";
import { requirePageUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { PERMS } from "@/lib/rbac";
import { mergeSite } from "@/lib/site-types";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requirePageUser(PERMS.siteEdit);
  const { Site } = await getDb();
  const doc = await Site.findOne({ key: "site" }).lean<any>();
  return (
    <>
      <PageHeader title="Site Editor" subtitle="Change text, logo, colours and photos. The preview updates as you type; press Publish when you're happy." />
      <SiteEditor initial={mergeSite(doc?.data)} updatedAt={doc?.updatedAt ? new Date(doc.updatedAt).toISOString() : null} />
    </>
  );
}
