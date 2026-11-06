import { z } from "zod";
import { ApiError, requireApiUser } from "./auth";
import { getDb } from "./db";
import { PERMS } from "./rbac";
import { recordScope } from "./scope";
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
  const filter: Filter = { year: p.year ?? now.getFullYear(), month: p.month ?? now.getMonth() + 1, zone: p.zone || scope.zone && String(scope.zone) || undefined, area: p.area || scope.area && String(scope.area) || undefined, parish: p.parish || scope.parish && String(scope.parish) || undefined };
  // A scoped user can never widen their view by passing another id.
  if (scope.zone) filter.zone = String(scope.zone);
  if (scope.area) filter.area = String(scope.area);
  if (scope.parish) filter.parish = String(scope.parish);
  const { Remittance, Parish, Zone, Area } = await getDb();
  const pf: any = {};
  if (filter.zone) pf.zone = filter.zone;
  if (filter.area) pf.area = filter.area;
  if (filter.parish) pf._id = filter.parish;
  const [rows, parishes, zones, areas] = await Promise.all([
    Remittance.find({ year: filter.year, ...(scope.zone ? { zone: scope.zone } : {}), ...(scope.area ? { area: scope.area } : {}), ...(scope.parish ? { parish: scope.parish } : {}) }).lean<any[]>(),
    Parish.find(pf).lean<any[]>(), Zone.find({}).lean<any[]>(), Area.find({}).lean<any[]>(),
  ]);
  return { rows, parishes, zones, areas, filter };
}
