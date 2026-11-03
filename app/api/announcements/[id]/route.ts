import { z } from "zod";
import { handle, audit } from "@/lib/api";
import { ApiError, requireApiUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { PERMS } from "@/lib/rbac";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };
const body = z.object({ title: z.string().trim().min(3).max(160), body: z.string().max(8000).default(""), imageId: z.string().optional().default(""), pinned: z.boolean().default(false), status: z.enum(["draft", "published"]).default("draft") });

export const PATCH = handle<Ctx>(async (req, ctx) => {
  const user = await requireApiUser(PERMS.content);
  const { id } = await ctx.params;
  const i = body.parse(await req.json());
  const { Announcement } = await getDb();
  const a = await Announcement.findById(id);
  if (!a) throw new ApiError(404, "Announcement not found.");
  if (i.status === "published" && !a.publishedAt) a.publishedAt = new Date();
  a.set({ ...i, imageId: i.imageId || undefined });
  await a.save();
  await audit(user, "announcement.update", a.title, { status: a.status }, req);
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
