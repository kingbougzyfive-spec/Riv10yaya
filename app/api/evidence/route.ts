import { handle } from "@/lib/api";
import { ApiError, requireApiUser } from "@/lib/auth";
import crypto from "node:crypto";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";
const MAX = 4 * 1024 * 1024;
const ALLOWED = ["image/png", "image/jpeg", "image/webp", "application/pdf"];

/** Private upload of payment evidence (receipt / transfer screenshot / PDF). Parish admins only. */
export const POST = handle(async (req) => {
  const user = await requireApiUser(["parish_admin"]);
  if (!user.parish) throw new ApiError(400, "Your account isn't linked to a parish yet.");
  const file = (await req.formData()).get("file");
  if (!(file instanceof File)) throw new ApiError(400, "Choose a file to upload.");
  if (!ALLOWED.includes(file.type)) throw new ApiError(415, "Upload a JPG, PNG, WebP or PDF.");
  if (file.size > MAX) throw new ApiError(413, "That file is over 4 MB.");
  const { Media } = await getDb();
  const data = Buffer.from(await file.arrayBuffer());
  const hash = crypto.createHash("sha256").update(data).digest("hex");
  const m = await Media.create({ name: file.name.slice(0, 120), mime: file.type, size: file.size, data, hash, uploadedBy: user.id, private: true, parish: user.parish });
  return { id: String(m._id), name: m.name };
});
