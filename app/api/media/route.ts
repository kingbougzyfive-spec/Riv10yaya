import { handle, audit } from "@/lib/api";
import { ApiError, requireApiUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { PERMS } from "@/lib/rbac";

export const dynamic = "force-dynamic";
const MAX = 4 * 1024 * 1024;
const ALLOWED = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"];

export const GET = handle(async () => {
  await requireApiUser(PERMS.media);
  const { Media } = await getDb();
  const items = await Media.find({ private: { $ne: true } }, { data: 0 }).sort({ createdAt: -1 }).limit(300).lean<any[]>();
  return { items: items.map((m) => ({ id: String(m._id), name: m.name, mime: m.mime, size: m.size, createdAt: m.createdAt })) };
});

export const POST = handle(async (req) => {
  const user = await requireApiUser(PERMS.media);
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new ApiError(400, "Choose an image to upload.");
  if (!ALLOWED.includes(file.type)) throw new ApiError(415, "Upload a PNG, JPG, WebP, GIF or SVG image.");
  if (file.size > MAX) throw new ApiError(413, "That image is over 4 MB. Please use a smaller one.");
  const { Media } = await getDb();
  const doc = await Media.create({
    name: file.name.slice(0, 120),
    mime: file.type,
    size: file.size,
    data: Buffer.from(await file.arrayBuffer()),
    uploadedBy: user.id,
  });
  await audit(user, "media.upload", file.name, undefined, req);
  return { id: String(doc._id), name: doc.name };
});
