import { handle, audit } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { PERMS } from "@/lib/rbac";
import { loadGov } from "@/lib/gov-server";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** Removes the record and the stored file together. */
export const DELETE = handle<Ctx>(async (req, ctx) => {
  const user = await requireApiUser(PERMS.governanceManage);
  const d = await loadGov("GovDocument", (await ctx.params).id, user, true);
  const { Media, GovDocument } = await getDb();
  await Media.deleteOne({ _id: d.media, document: true });
  await GovDocument.deleteOne({ _id: d._id });
  await audit(user, "document.delete", d.title, undefined, req);
  return { ok: true };
});
