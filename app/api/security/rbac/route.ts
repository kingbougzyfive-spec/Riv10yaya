import { handle, audit } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { catalog, syncRbacCatalog } from "@/lib/rbac-catalog";

export const dynamic = "force-dynamic";

/** The role and permission catalogue as defined in code (what the Role and Permission collections mirror). */
export const GET = handle(async () => {
  await requireApiUser(["super_admin", "auditor"]);
  return catalog();
});
export const POST = handle(async (req) => {
  const user = await requireApiUser(["super_admin"]);
  const out = await syncRbacCatalog(await getDb());
  await audit(user, "security.rbac_catalog_sync", "roles and permissions", { entity: "rbac", after: out }, req);
  return out;
});
