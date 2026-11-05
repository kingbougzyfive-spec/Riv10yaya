import { z } from "zod";
import { handle } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Your own notifications only. */
export const GET = handle(async () => {
  const user = await requireApiUser();
  const { Notification } = await getDb();
  const [rows, unread] = await Promise.all([
    Notification.find({ user: user.id }).sort({ createdAt: -1 }).limit(30).lean<any[]>(),
    Notification.countDocuments({ user: user.id, readAt: { $exists: false } }),
  ]);
  return { unread, rows: rows.map((n) => ({ id: String(n._id), title: n.title, body: n.body, link: n.link, read: !!n.readAt, at: n.createdAt })) };
});

export const PATCH = handle(async (req) => {
  const user = await requireApiUser();
  const i = z.object({ id: z.string().optional(), all: z.boolean().optional() }).parse(await req.json());
  const { Notification } = await getDb();
  const f: any = { user: user.id, readAt: { $exists: false } };
  if (!i.all && i.id) f._id = i.id;
  await Notification.updateMany(f, { $set: { readAt: new Date() } });
  return { ok: true };
});
