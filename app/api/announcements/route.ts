import { z } from "zod";
import { handle, audit } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { PERMS } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  await requireApiUser(PERMS.content);
  const { Announcement } = await getDb();
  const rows = await Announcement.find().sort({ pinned: -1, createdAt: -1 }).limit(300).lean<any[]>();
  return { rows: rows.map((r) => ({ id: String(r._id), title: r.title, body: r.body, imageId: r.imageId ? String(r.imageId) : "", pinned: r.pinned, status: r.status, publishedAt: r.publishedAt })) };
});

const body = z.object({ title: z.string().trim().min(3).max(160), body: z.string().max(8000).default(""), imageId: z.string().optional().default(""), pinned: z.boolean().default(false), status: z.enum(["draft", "published"]).default("draft") });

export const POST = handle(async (req) => {
  const user = await requireApiUser(PERMS.content);
  const i = body.parse(await req.json());
  const { Announcement } = await getDb();
  const doc = await Announcement.create({ ...i, imageId: i.imageId || undefined, publishedAt: i.status === "published" ? new Date() : undefined, createdBy: user.id });
  await audit(user, "announcement.create", i.title, undefined, req);
  return { id: String(doc._id) };
});
