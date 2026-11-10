import { looksLikeId } from "./slug";

/** Finds an event by its public slug, or by id (older links). An event without a slug gets one the first time it is looked up. */
export async function findEventByKey(Event: any, key: string) {
  const k = String(key || "").trim();
  if (!k) return null;
  if (looksLikeId(k)) {
    const e = await Event.findById(k);
    if (e && !e.slug) await e.save().catch(() => {});
    return e;
  }
  return Event.findOne({ slug: k.toLowerCase() });
}
