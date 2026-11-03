import { getDb } from "./db";
import { mergeSite, type SiteData } from "./site-types";

/** Public pages call this. If the database is down or unset, the site still renders with defaults. */
export async function getSite(): Promise<{ site: SiteData; live: boolean }> {
  try {
    const { Site } = await getDb();
    const doc = await Site.findOne({ key: "site" }).lean<any>();
    return { site: mergeSite(doc?.data), live: true };
  } catch {
    return { site: mergeSite(null), live: false };
  }
}

export async function getOrgCounts() {
  try {
    const { Zone, Area, Parish } = await getDb();
    const [zones, areas, parishes] = await Promise.all([
      Zone.countDocuments({ active: true }),
      Area.countDocuments({ active: true }),
      Parish.countDocuments({ active: true }),
    ]);
    return { zones, areas, parishes };
  } catch {
    return null;
  }
}
