import type { Schema } from "mongoose";

type Z = { hasAreas: boolean } | null;
type A = { zone: unknown } | null;
type P = { zone: unknown; area?: unknown } | null;
const s = (v: unknown) => (v == null || v === "" ? null : String(v));

/** Pure rule check for the Province → Zone → (Area) → Parish chain. Returns a plain-language problem, or null.
 *  Only the ids that are supplied are checked, so a record may carry just an area, or just a parish.
 *  `requireArea`: a parish in a zone that has areas must name its area (used for Parish records themselves). */
export function chainProblem(
  given: { zone?: unknown; area?: unknown; parish?: unknown },
  found: { zone: Z; area: A; parish: P },
  opts: { requireArea?: boolean } = {},
): string | null {
  const zone = s(given.zone), area = s(given.area), parish = s(given.parish);
  if (zone && !found.zone) return "That zone doesn't exist.";
  if (area && !found.area) return "That area doesn't exist.";
  if (parish && !found.parish) return "That parish doesn't exist.";
  const aZone = found.area ? s(found.area.zone) : null;
  const pZone = found.parish ? s(found.parish.zone) : null;
  const pArea = found.parish ? s(found.parish.area) : null;
  if (zone && area && aZone !== zone) return "That area doesn't belong to the selected zone.";
  if (zone && parish && pZone !== zone) return "That parish doesn't belong to the selected zone.";
  if (!zone && area && parish && aZone !== pZone) return "That parish doesn't belong to the selected area's zone.";
  if (area && parish && pArea !== area) return "That parish doesn't belong to the selected area.";
  if (found.zone && !found.zone.hasAreas) {
    if (area) return "This zone is standalone: parishes sit directly under it, with no area.";
    if (parish && pArea) return "That parish sits under an area, but the zone is standalone.";
  }
  if (opts.requireArea && found.zone?.hasAreas && parish && !area && !pArea) return "This zone has areas, so the parish must belong to one.";
  return null;
}

/** Makes a schema refuse impossible organisational combinations when a record is created or its placement changes.
 *  This is enforced in the data layer, so it holds for every route, script and import. */
export function orgChain(schema: Schema, o: { requireArea?: boolean; self?: boolean } = {}) {
  schema.pre("validate", async function (this: any) {
    if (!this.isNew && !this.isModified("zone") && !this.isModified("area") && !this.isModified("parish")) return;
    const zone = this.zone ?? null, area = this.area ?? null, parish = o.self ? null : this.parish ?? null;
    if (!zone && !area && !parish) return;
    const [Z, A, P] = [this.model("Zone"), this.model("Area"), this.model("Parish")];
    const [fz, fa, fp] = await Promise.all([
      zone ? Z.findById(zone, { hasAreas: 1 }).lean() : null,
      area ? A.findById(area, { zone: 1 }).lean() : null,
      parish ? P.findById(parish, { zone: 1, area: 1 }).lean() : null,
    ]);
    const bad = chainProblem({ zone, area, parish }, { zone: fz as Z, area: fa as A, parish: fp as P }, { requireArea: o.requireArea });
    if (bad) this.invalidate(area && bad.includes("area") ? "area" : parish && bad.includes("parish") ? "parish" : "zone", bad);
  });
}

/** A report's level decides which of area / parish it must (and must not) carry. */
export function reportShapeProblem(r: { type?: string; area?: unknown; parish?: unknown }): string | null {
  const area = s(r.area), parish = s(r.parish);
  if (r.type === "parish") return parish ? null : "A parish report must name its parish.";
  if (r.type === "area") return !area ? "An area report must name its area." : parish ? "An area report can't name a single parish." : null;
  if (r.type === "zone") return area || parish ? "A zonal report covers the whole zone, so it names no area or parish." : null;
  return "Unknown report level.";
}
