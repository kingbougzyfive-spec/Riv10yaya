import { z } from "zod";
import { ApiError, requireApiUser } from "./auth";
import { getDb } from "./db";
import { PERMS } from "./rbac";
import { clampScope, isProvincial, orgFilters, recordScope } from "./scope";
import type { DashInput, Filter } from "./finance-dash";

const q = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  month: z.coerce.number().int().min(0).max(12).optional(),
  zone: z.string().optional(), area: z.string().optional(), parish: z.string().optional(),
});

/** Loads the real records for the dashboard, already limited to what this user may see. */
export async function loadDash(req: Request): Promise<DashInput> {
  const user = await requireApiUser(PERMS.finance);
  const scope: any = await recordScope(user);
  if (scope === null) throw new ApiError(403, "No access.");
  const p = q.parse(Object.fromEntries(new URL(req.url).searchParams));
  const now = new Date();
  // What they asked for can only narrow what they are in charge of, never widen it (clampScope returns "matches nothing" for anything outside).
  const asked = new URLSearchParams(Object.entries({ zone: p.zone, area: p.area, parish: p.parish }).filter(([, v]) => !!v) as [string, string][]);
  const f: any = clampScope(scope, asked);
  const plain = (v: unknown) => (typeof v === "string" ? v : undefined);
  const filter: Filter = { year: p.year ?? now.getFullYear(), month: p.month ?? now.getMonth() + 1, zone: plain(f.zone), area: plain(f.area), parish: plain(f.parish) };
  const { Remittance, Parish, Zone, Area } = await getDb();
  const of = isProvincial(user) ? { zone: {}, area: {}, parish: {} } : await orgFilters(user);
  const narrow: any = {};
  if (plain(f.zone)) narrow.zone = f.zone;
  if (plain(f.area)) narrow.area = f.area;
  if (plain(f.parish)) narrow._id = f.parish;
  const [rows, parishes, zones, areas] = await Promise.all([
    Remittance.find({ year: filter.year, ...f }).lean<any[]>(),
    Parish.find({ $and: [of.parish, narrow] }).lean<any[]>(), Zone.find(of.zone).lean<any[]>(), Area.find(of.area).lean<any[]>(),
  ]);
  return { rows, parishes, zones, areas, filter };
}
