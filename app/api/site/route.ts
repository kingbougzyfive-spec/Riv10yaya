import { handle, audit } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { PERMS } from "@/lib/rbac";
import { mergeSite, siteSchema } from "@/lib/site-types";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  await requireApiUser(PERMS.siteEdit);
  const { Site } = await getDb();
  const doc = await Site.findOne({ key: "site" }).lean<any>();
  return { site: mergeSite(doc?.data), updatedAt: doc?.updatedAt ?? null };
});

export const PUT = handle(async (req) => {
  const user = await requireApiUser(PERMS.siteEdit);
  const data = siteSchema.parse(await req.json());
  const { Site } = await getDb();
  const doc = await Site.findOneAndUpdate(
    { key: "site" },
    { $set: { data, updatedBy: user.id } },
    { upsert: true, new: true },
  );
  await audit(user, "site.publish", "site", undefined, req);
  return { ok: true, updatedAt: doc.updatedAt };
});
