import { getSite } from "@/lib/cms";
import { getDb } from "@/lib/db";
import { ZonesView } from "@/components/site/views";
export const dynamic = "force-dynamic";
export const metadata = { title: "Zones & Areas" };

export default async function Page() {
  const { site } = await getSite();
  let zones: any[] = [];
  try {
    const { Zone, Area, Parish } = await getDb();
    const [z, a, p] = await Promise.all([
      Zone.find({ active: true }).sort({ name: 1 }).lean<any[]>(),
      Area.find({ active: true }).sort({ name: 1 }).lean<any[]>(),
      Parish.find({ active: true }, { name: 1, zone: 1, area: 1 }).sort({ name: 1 }).lean<any[]>(),
    ]);
    zones = z.map((zone) => ({
      id: String(zone._id), name: zone.name, hasAreas: zone.hasAreas,
      areas: a.filter((x) => String(x.zone) === String(zone._id)).map((area) => ({
        id: String(area._id), name: area.name,
        parishes: p.filter((x) => String(x.area) === String(area._id)).map((x) => x.name),
      })),
      parishes: p.filter((x) => String(x.zone) === String(zone._id) && !x.area).map((x) => x.name),
    }));
  } catch {}
  return <ZonesView site={site} zones={zones} />;
}
