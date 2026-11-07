import { handle } from "@/lib/api";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const { Department } = await getDb();
  const rows = await Department.find({ active: true, level: { $in: ["province", null] } }).sort({ order: 1, name: 1 }).lean<any[]>();
  return { rows: rows.map((r) => ({ id: String(r._id), name: r.name, description: r.description, headName: r.headName ?? "", imageId: r.imageId ? String(r.imageId) : "" })) };
});
