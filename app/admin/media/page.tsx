import { PageHeader } from "@/components/admin/AdminShell";
import { MediaManager } from "@/components/admin/Media";
import { requirePageUser } from "@/lib/auth";
import { PERMS } from "@/lib/rbac";

export default async function Page() {
  await requirePageUser(PERMS.media);
  return (
    <>
      <PageHeader title="Media Library" subtitle="Everything you upload here can be picked in the Site Editor: logos, hero photos, leader portraits and gallery images." />
      <MediaManager />
    </>
  );
}
