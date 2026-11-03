import { z } from "zod";
import { handle, audit } from "@/lib/api";
import { ApiError, requireApiUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { PERMS } from "@/lib/rbac";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };
const body = z.object({ name: z.string().trim().min(2).max(100), description: z.string().max(2000).default(""), headName: z.string().max(100).optional().default(""), imageId: z.string().optional().default(""), order: z.number().int().min(0).max(999).default(0), active: z.boolean().default(true) });

export const PATCH = handle<Ctx>(async (req, ctx) => {
  const user = await requireApiUser(PERMS.content);
  const { id } = await ctx.params;
  const i = body.parse(await req.json());
  const { Department } = await getDb();
  const d = await Department.findById(id);
  if (!d) throw new ApiError(404, "Department not found.");
  d.set({ ...i, imageId: i.imageId || undefined });
  await d.save();
  await audit(user, "department.update", d.name, undefined, req);
  return { ok: true };
});

export const DELETE = handle<Ctx>(async (req, ctx) => {
  const user = await requireApiUser(PERMS.content);
  const { id } = await ctx.params;
  const { Department } = await getDb();
  await Department.findByIdAndDelete(id);
  await audit(user, "department.delete", id, undefined, req);
  return { ok: true };
});
