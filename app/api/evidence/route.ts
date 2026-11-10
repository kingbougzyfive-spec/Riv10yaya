import { handle, audit } from "@/lib/api";
import { readUpload } from "@/lib/upload";
import { HOUR, rateLimit } from "@/lib/ratelimit";
import { ApiError, requireApiUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";
const MAX = 4 * 1024 * 1024;

/** Private upload of payment evidence (receipt / transfer screenshot / PDF). Parish admins only. */
export const POST = handle(async (req) => {
  // Parishes upload receipts; finance staff may attach statement extracts or other supporting evidence.
  const user = await requireApiUser(["parish_admin", "finance_admin", "super_admin"]);
  if (user.role === "parish_admin" && !user.parish) throw new ApiError(400, "Your account isn't linked to a parish yet.");
  await rateLimit(`evidence:${user.id}`, 40, HOUR, "You've uploaded a lot of files in the last hour. Please wait a little.");
  const up = await readUpload((await req.formData()).get("file"), ["png", "jpeg", "webp", "pdf"], MAX);
  const { Media } = await getDb();
  // Payment evidence is kept permanently: it has no delete route, and the media delete route refuses private files.
  const m = await Media.create({ name: up.name, mime: up.mime, size: up.data.length, data: up.data, hash: up.hash, uploadedBy: user.id, private: true, ...(user.role === "parish_admin" ? { parish: user.parish } : {}) });
  await audit(user, "evidence.upload", up.name, { entity: "media", entityId: String(m._id), after: { sha256: up.hash, bytes: up.data.length, type: up.mime, parish: user.parish ?? null } }, req);
  return { id: String(m._id), name: m.name };
});
