import { audit, handle } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { syncStructure } from "@/lib/structure-seed";
import { PERMS } from "@/lib/rbac";

export const dynamic = "force-dynamic";

/** Adds any zone, area or parish from the official Rivers Province 10 list that is missing. Never changes or removes what is already there. */
export const POST = handle(async (req) => {
  const user = await requireApiUser(PERMS.orgManage);
  const r = await syncStructure();
  await audit(user, "org.import", "Rivers Province 10 list", { after: r }, req);
  return r;
});
