import { Building2, Church, Layers, MapPin } from "lucide-react";
import Link from "next/link";
import { SimplePage } from "@/components/site/views";
import { getSite } from "@/lib/cms";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Our structure" };

/** How the province is organised: zones, the areas inside them, and the parishes. Counts and names only. */
export default async function Page() {
  const { site } = await getSite();
  let zones: { id: string; name: string; hasAreas: boolean; areas: number; parishes: number }[] = [];
  try {
    const { Zone, Area, Parish } = await getDb();
    const [z, a, p] = await Promise.all([Zone.find({ active: true }).sort({ name: 1 }).lean<any[]>(), Area.find({ active: true }, { zone: 1 }).lean<any[]>(), Parish.find({ active: true }, { zone: 1 }).lean<any[]>()]);
    zones = z.map((x) => ({ id: String(x._id), name: x.name, hasAreas: x.hasAreas, areas: a.filter((y) => String(y.zone) === String(x._id)).length, parishes: p.filter((y) => String(y.zone) === String(x._id)).length }));
  } catch {}
  const tot = zones.reduce((n, z) => ({ areas: n.areas + z.areas, parishes: n.parishes + z.parishes }), { areas: 0, parishes: 0 });
  const steps = [
    { icon: Building2, t: "Province", d: "The whole of Rivers 10: one Youth leadership and one provincial finance office." },
    { icon: Layers, t: "Zones", d: "Parishes are grouped into zones. Each zone has its own zonal administrators." },
    { icon: MapPin, t: "Areas (where used)", d: "Larger zones are divided into areas. A standalone zone has no areas: its parishes sit directly under the zone." },
    { icon: Church, t: "Parishes", d: "Every parish belongs to exactly one zone, and to one area where its zone has areas. Each parish reports and remits for itself." },
  ];
  return (
    <SimplePage site={site} current="/structure">
      <section className="mx-auto max-w-5xl px-5 py-14 sm:px-6">
        <h1 className="text-4xl font-black">Our structure</h1>
        <p className="mt-3 max-w-2xl text-white/65">{zones.length} zones, {tot.areas} areas and {tot.parishes} parishes, working together under one provincial Youth leadership.</p>
        <ol className="mt-10 grid gap-4 sm:grid-cols-2">{steps.map((s, i) => (
          <li key={s.t} className="glass flex gap-4 p-5"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand/15 text-brand"><s.icon className="h-5 w-5" /></span><div><p className="font-bold">{i + 1}. {s.t}</p><p className="mt-1 text-sm text-white/65">{s.d}</p></div></li>
        ))}</ol>
        {zones.length > 0 && (
          <div className="mt-12">
            <div className="mb-4 flex items-end justify-between"><h2 className="text-2xl font-black">Zones</h2><Link href="/zones" className="text-sm text-brand underline">See every area and parish</Link></div>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{zones.map((z) => (
              <li key={z.id} className="glass p-4"><p className="font-bold">{z.name}</p><p className="mt-1 text-sm text-white/65">{z.hasAreas ? `${z.areas} area${z.areas === 1 ? "" : "s"} · ` : "Standalone zone · "}{z.parishes} parish{z.parishes === 1 ? "" : "es"}</p></li>
            ))}</ul>
          </div>
        )}
      </section>
    </SimplePage>
  );
}
