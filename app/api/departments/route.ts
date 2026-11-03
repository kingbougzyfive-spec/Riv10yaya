import { z } from "zod";
import { handle, audit } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { PERMS } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  await requireApiUser(PERMS.content);
  const { Department } = await getDb();
  const rows = await Department.find().sort({ order: 1, name: 1 }).lean<any[]>();
  return { rows: rows.map((r) => ({ id: String(r._id), name: r.name, description: r.description, headName: r.headName ?? "", imageId: r.imageId ? String(r.imageId) : "", order: r.order, active: r.active })) };
});

const body = z.object({ name: z.string().trim().min(2).max(100), description: z.string().max(2000).default(""), headName: z.string().max(100).optional().default(""), imageId: z.string().optional().default(""), order: z.number().int().min(0).max(999).default(0), active: z.boolean().default(true) });

export const POST = handle(async (req) => {
  const user = await requireApiUser(PERMS.content);
  const i = body.parse(await req.json());
  const { Department } = await getDb();
  const d = await Department.create({ ...i, imageId: i.imageId || undefined });
  await audit(user, "department.create", i.name, undefined, req);
  return { id: String(d._id) };
});
