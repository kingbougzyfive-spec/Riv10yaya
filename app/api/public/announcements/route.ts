import { handle } from "@/lib/api";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export const GET = handle(async (req) => {
  const limit = Math.min(50, Number(new URL(req.url).searchParams.get("limit")) || 30);
  const { Announcement } = await getDb();
  const rows = await Announcement.find({ status: "published" }).sort({ pinned: -1, publishedAt: -1 }).limit(limit).lean<any[]>();
  return { rows: rows.map((r) => ({ id: String(r._id), title: r.title, body: r.body, imageId: r.imageId ? String(r.imageId) : "", pinned: r.pinned, publishedAt: r.publishedAt })) };
});
