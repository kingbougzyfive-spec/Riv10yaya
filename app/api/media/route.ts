import { handle, audit } from "@/lib/api";
import { ApiError, requireApiUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { PERMS } from "@/lib/rbac";
import { readUpload } from "@/lib/upload";
import { HOUR, rateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";
const MAX = 4 * 1024 * 1024;

export const GET = handle(async () => {
  await requireApiUser(PERMS.media);
  const { Media } = await getDb();
  const items = await Media.find({ private: { $ne: true } }, { data: 0 }).sort({ createdAt: -1 }).limit(300).lean<any[]>();
  return { items: items.map((m) => ({ id: String(m._id), name: m.name, mime: m.mime, size: m.size, createdAt: m.createdAt })) };
});

export const POST = handle(async (req) => {
  const user = await requireApiUser(PERMS.media);
  await rateLimit(`media:${user.id}`, 60, HOUR, "You've uploaded a lot of images in the last hour. Please wait a little.");
  // SVG is not accepted: it can carry scripts. PNG, JPG, WebP and GIF are checked by their real file signature.
  const up = await readUpload((await req.formData()).get("file"), ["png", "jpeg", "webp", "gif"], MAX);
  const { Media } = await getDb();
  const doc = await Media.create({ name: up.name, mime: up.mime, size: up.data.length, data: up.data, hash: up.hash, uploadedBy: user.id });
  await audit(user, "media.upload", up.name, { entity: "media", entityId: String(doc._id), after: { sha256: up.hash, bytes: up.data.length, type: up.mime } }, req);
  return { id: String(doc._id), name: doc.name };
});
