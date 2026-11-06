import { handle } from "@/lib/api";
import { dashboard } from "@/lib/finance-dash";
import { loadDash } from "@/lib/finance-load";

export const dynamic = "force-dynamic";

/** Every figure is calculated from Remittance/Parish records at request time. */
export const GET = handle(async (req) => {
  const input = await loadDash(req);
  return { ...dashboard(input), zones: input.zones.map((z) => ({ id: String(z._id), name: z.name })), areas: input.areas.map((a) => ({ id: String(a._id), name: a.name, zone: String(a.zone) })), parishes: input.parishes.map((p) => ({ id: String(p._id), name: p.name, zone: String(p.zone), area: p.area ? String(p.area) : null })) };
});
