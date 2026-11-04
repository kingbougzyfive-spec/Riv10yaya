import { redirect } from "next/navigation";
import { getOrgCounts, getSite } from "@/lib/cms";
import { getDb, isDatabaseConfigured } from "@/lib/db";
import { HomeView } from "@/components/site/views";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (!isDatabaseConfigured()) redirect("/setup");
  const [{ site }, counts, next] = await Promise.all([getSite(), getOrgCounts(), nextEvent()]);
  return <HomeView site={site} counts={counts} next={next} />;
}

/** The soonest published event that has not started yet (null when none, or when the database is unreachable). */
async function nextEvent() {
  try {
    const { Event } = await getDb();
    const e = await Event.findOne({ status: "published", startsAt: { $gte: new Date() } }).sort({ startsAt: 1 }).lean<any>();
    return e ? { id: String(e._id), title: e.title as string, startsAt: new Date(e.startsAt).toISOString(), registrationOpen: !!e.registrationOpen } : null;
  } catch { return null; }
}
