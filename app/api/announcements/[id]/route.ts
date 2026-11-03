import { z } from "zod";
import { handle, audit } from "@/lib/api";
import { ApiError, requireApiUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { PERMS } from "@/lib/rbac";
import { sendPush } from "@/lib/push";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };
const body = z.object({ title: z.string().trim().min(3).max(160), body: z.string().max(8000).default(""), imageId: z.string().optional().default(""), pinned: z.boolean().default(false), status: z.enum(["draft", "published"]).default("draft"), notify: z.boolean().default(true) });

export const PATCH = handle<Ctx>(async (req, ctx) => {
  const user = await requireApiUser(PERMS.content);
  const { id } = await ctx.params;
  const i = body.parse(await req.json());
  const { Announcement } = await getDb();
  const a = await Announcement.findById(id);
  if (!a) throw new ApiError(404, "Announcement not found.");
  const firstPublish = i.status === "published" && !a.publishedAt;
  if (firstPublish) a.publishedAt = new Date();
  const { notify, ...fields } = i;
  a.set({ ...fields, imageId: i.imageId || undefined });
  await a.save();
  await audit(user, "announcement.update", a.title, { status: a.status }, req);
  if (firstPublish && notify) await sendPush({ title: a.title, body: a.body, url: "/announcements" });
  return { ok: true };
});

export const DELETE = handle<Ctx>(async (req, ctx) => {
  const user = await requireApiUser(PERMS.content);
  const { id } = await ctx.params;
  const { Announcement } = await getDb();
  await Announcement.findByIdAndDelete(id);
  await audit(user, "announcement.delete", id, undefined, req);
  return { ok: true };
});
