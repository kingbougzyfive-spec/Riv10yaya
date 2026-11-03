import { handle } from "@/lib/api";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Names only, for registration dropdowns. No contact data. */
export const GET = handle(async () => {
  const { Zone, Area, Parish } = await getDb();
  const [z, a, p] = await Promise.all([Zone.find({ active: true }).sort({ name: 1 }).lean<any[]>(), Area.find({ active: true }).sort({ name: 1 }).lean<any[]>(), Parish.find({ active: true }).sort({ name: 1 }).lean<any[]>()]);
  return {
    zones: z.map((x) => ({ id: String(x._id), name: x.name, hasAreas: x.hasAreas })),
    areas: a.map((x) => ({ id: String(x._id), name: x.name, zone: String(x.zone) })),
    parishes: p.map((x) => ({ id: String(x._id), name: x.name, zone: String(x.zone), area: x.area ? String(x.area) : null })),
  };
});
