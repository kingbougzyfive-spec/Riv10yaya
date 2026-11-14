import { keyOf } from "./api";
import { getDbRaw as getDb } from "./db";
import { RIVERS10_STRUCTURE } from "./rccg-structure";

export type SyncResult = { zones: number; areas: number; parishes: number; skipped: number; totals: { zones: number; areas: number; parishes: number } };

const isDup = (e: any) => e?.code === 11000 || e?.writeErrors?.every?.((w: any) => w?.err?.code === 11000 || w?.code === 11000);

/**
 * Adds every Rivers Province 10 zone, area and parish from the official list that is not in the database yet.
 * Safe to run any number of times: it matches by name, only ever adds, and never renames, deactivates or deletes anything an administrator has changed.
 */
export async function syncStructure(): Promise<SyncResult> {
  const { Zone, Area, Parish } = await getDb();
  const out: SyncResult = { zones: 0, areas: 0, parishes: 0, skipped: 0, totals: { zones: 0, areas: 0, parishes: 0 } };
  const insert = async (M: any, docs: any[]) => {
    if (!docs.length) return 0;
    try { await M.insertMany(docs, { ordered: false }); return docs.length; } catch (e) { if (!isDup(e)) throw e; return 0; } // another request got there first
  };

  // A handful of bulk queries instead of hundreds of small ones: this must finish well inside a serverless time limit.
  let zones = await Zone.find({}, { nameKey: 1, code: 1, hasAreas: 1 }).lean<any[]>();
  // A zone counts as already present if its name OR its province code matches, so renaming a zone never creates a duplicate.
  const zoneKeys = new Set(zones.map((z) => z.nameKey));
  const zoneCodes = new Set(zones.map((z) => z.code).filter(Boolean));
  out.zones = await insert(Zone, RIVERS10_STRUCTURE.filter((z) => !zoneKeys.has(keyOf(z.name)) && !zoneCodes.has(z.code)).map((z) => ({ name: z.name, nameKey: keyOf(z.name), code: z.code, hasAreas: true })));
  if (out.zones) zones = await Zone.find({}, { nameKey: 1, code: 1, hasAreas: 1 }).lean<any[]>();
  const zoneByKey = new Map(zones.map((z) => [z.nameKey, z]));
  const zoneByCode = new Map(zones.filter((z) => z.code).map((z) => [z.code, z]));
  const zoneOf = (z: { name: string; code: string }) => zoneByCode.get(z.code) ?? zoneByKey.get(keyOf(z.name));

  const usable = RIVERS10_STRUCTURE.filter((z) => {
    const zone = zoneOf(z);
    if (!zone) return false;
    if (!zone.hasAreas) { out.skipped += z.areas.reduce((n, a) => n + 1 + a.parishes.length, 0); return false; } // an administrator made it a standalone zone: leave it alone
    return true;
  });
  const zoneIds = usable.map((z) => zoneOf(z)._id);

  let areas = await Area.find({ zone: { $in: zoneIds } }, { nameKey: 1, zone: 1, code: 1 }).lean<any[]>();
  const haveArea = new Set(areas.flatMap((a) => [`${a.zone}|${a.nameKey}`, ...(a.code ? [`${a.zone}|code:${a.code}`] : [])]));
  const newAreas: any[] = [];
  for (const z of usable) for (const a of z.areas) {
    const zid = zoneOf(z)._id;
    if (!haveArea.has(`${zid}|${keyOf(a.name)}`) && !haveArea.has(`${zid}|code:${a.code}`)) newAreas.push({ name: a.name, nameKey: keyOf(a.name), code: a.code, zone: zid });
  }
  out.areas = await insert(Area, newAreas);
  if (out.areas) areas = await Area.find({ zone: { $in: zoneIds } }, { nameKey: 1, zone: 1, code: 1 }).lean<any[]>();
  const areaByKey = new Map(areas.flatMap((a) => [[`${a.zone}|${a.nameKey}`, a], ...(a.code ? [[`${a.zone}|code:${a.code}`, a]] : [])] as [string, any][]));

  const codes = RIVERS10_STRUCTURE.flatMap((z) => z.areas.flatMap((a) => a.parishes.map((p) => p.code)));
  const parishes = await Parish.find({ $or: [{ zone: { $in: zoneIds } }, { code: { $in: codes } }] }, { nameKey: 1, zone: 1, area: 1, code: 1 }).lean<any[]>();
  const haveParish = new Set(parishes.flatMap((p) => [`${p.zone}|${p.area ?? ""}|${p.nameKey}`, ...(p.code ? [`code:${p.code}`] : [])]));
  const newParishes: any[] = [];
  for (const z of usable) {
    const zid = zoneOf(z)._id;
    for (const a of z.areas) {
      const area = areaByKey.get(`${zid}|code:${a.code}`) ?? areaByKey.get(`${zid}|${keyOf(a.name)}`);
      if (!area) continue;
      for (const p of a.parishes) {
        if (haveParish.has(`${zid}|${area._id}|${keyOf(p.name)}`) || haveParish.has(`code:${p.code}`)) continue;
        newParishes.push({ name: p.name, nameKey: keyOf(p.name), code: p.code, pastorPhone: p.phone || undefined, address: p.address || undefined, zone: zid, area: area._id, active: p.active });
      }
    }
  }
  out.parishes = await insert(Parish, newParishes);

  const [tz, ta, tp] = await Promise.all([Zone.countDocuments({ isSample: { $ne: true } }), Area.countDocuments({ isSample: { $ne: true } }), Parish.countDocuments({ isSample: { $ne: true } })]);
  out.totals = { zones: tz, areas: ta, parishes: tp };
  return out;
}

let checked = false;
export const structureLoaded = () => checked;
let inflight: Promise<void> | null = null;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Loads the official list the first time the app runs against a database, so every zone / area / parish drop-down is ready without anyone typing.
 * Runs once, ever. If several visitors arrive at the very same moment, one loads it and the rest wait for it, so nobody sees a half-filled list.
 */
export function ensureStructure(): Promise<void> {
  if (checked) return Promise.resolve();
  inflight ??= run().finally(() => { inflight = null; });
  return inflight;
}

async function run() {
  const { SystemConfig } = await getDb();
  const done = async () => !!(await SystemConfig.exists({ key: "structureSeeded" }));
  if (await done()) { checked = true; return; }

  // Claim the job. Only the request that inserts the claim row does the work; a claim older than a minute is a crashed attempt and can be taken over.
  const now = Date.now();
  let mine = !(await SystemConfig.findOneAndUpdate({ key: "structureSeeding" }, { $setOnInsert: { value: now } }, { upsert: true, new: false }).lean<any>());
  if (!mine) {
    const claim = await SystemConfig.findOne({ key: "structureSeeding" }).lean<any>();
    if (claim && now - Number(claim.value) > 60_000) {
      mine = !!(await SystemConfig.findOneAndUpdate({ key: "structureSeeding", value: claim.value }, { $set: { value: now } }).lean<any>());
    }
  }
  if (!mine) {
    for (let i = 0; i < 28 && !(await done()); i++) await wait(300); // up to ~8s, inside a 10s serverless limit
    if (await done()) checked = true;
    return;
  }
  try {
    await syncStructure();
    await SystemConfig.updateOne({ key: "structureSeeded" }, { $setOnInsert: { value: new Date().toISOString() } }, { upsert: true });
    checked = true;
  } finally {
    await SystemConfig.deleteOne({ key: "structureSeeding" }).catch(() => {});
  }
}
