import { z } from "zod";
import mongoose from "mongoose";
import { handle, audit, keyOf } from "@/lib/api";
import { ApiError, requireApiUser, type SessionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { PERMS } from "@/lib/rbac";

export const dynamic = "force-dynamic";

const oid = z.string().refine((v) => mongoose.isValidObjectId(v), "Invalid id");
const name = z.string().trim().min(2, "Name is too short").max(80);

const createSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("zone"), name, hasAreas: z.boolean().default(true), description: z.string().max(300).optional() }),
  z.object({ type: z.literal("area"), name, zone: oid }),
  z.object({ type: z.literal("parish"), name, zone: oid, area: oid.nullable().optional(), address: z.string().max(200).optional() }),
]);

const patchSchema = z.object({
  type: z.enum(["zone", "area", "parish"]),
  id: oid,
  name: name.optional(),
  active: z.boolean().optional(),
  hasAreas: z.boolean().optional(),
  description: z.string().max(300).optional(),
  address: z.string().max(200).optional(),
  zone: oid.optional(),
  area: oid.nullable().optional(),
  reason: z.string().max(300).optional(),
});

/** Every parish must sit on exactly one valid path: Zone → Area → Parish, or standalone Zone → Parish. */
async function validatePlacement(zoneId: string, areaId: string | null | undefined) {
  const { Zone, Area } = await getDb();
  const zone = await Zone.findById(zoneId).lean<any>();
  if (!zone) throw new ApiError(400, "That zone doesn't exist.");
  if (zone.hasAreas) {
    if (!areaId) throw new ApiError(400, `"${zone.name}" has areas, so choose the area this parish belongs to.`);
    const area = await Area.findById(areaId).lean<any>();
    if (!area || String(area.zone) !== zoneId) throw new ApiError(400, "That area doesn't belong to the selected zone.");
  } else if (areaId) {
    throw new ApiError(400, `"${zone.name}" is a standalone zone, so parishes sit directly under it (no area).`);
  }
}

function scopeFilter(u: SessionUser) {
  if (["super_admin", "finance_admin", "provincial_admin", "auditor"].includes(u.role)) return {};
  return null;
}

export const GET = handle(async () => {
  const user = await requireApiUser(PERMS.orgView);
  const { Zone, Area, Parish } = await getDb();
  let zf: any = {}, af: any = {}, pf: any = {};
  if (scopeFilter(user) === null) {
    if (user.role === "zonal_admin" && user.zone) { zf = { _id: user.zone }; af = { zone: user.zone }; pf = { zone: user.zone }; }
    else if (user.role === "area_admin" && user.area) {
      const a = await Area.findById(user.area).lean<any>();
      zf = { _id: a?.zone }; af = { _id: user.area }; pf = { area: user.area };
    } else if (user.role === "parish_admin" && user.parish) {
      const p = await Parish.findById(user.parish).lean<any>();
      zf = { _id: p?.zone }; af = p?.area ? { _id: p.area } : { _id: null }; pf = { _id: user.parish };
    } else { zf = af = pf = { _id: null }; }
  }
  const [zones, areas, parishes] = await Promise.all([
    Zone.find(zf).sort({ name: 1 }).lean<any[]>(),
    Area.find(af).sort({ name: 1 }).lean<any[]>(),
    Parish.find(pf, { transfers: 0 }).sort({ name: 1 }).lean<any[]>(),
  ]);
  const s = (d: any) => ({ ...d, id: String(d._id), _id: undefined, zone: d.zone ? String(d.zone) : undefined, area: d.area ? String(d.area) : null });
  return { zones: zones.map(s), areas: areas.map(s), parishes: parishes.map(s) };
});

export const POST = handle(async (req) => {
  const user = await requireApiUser(PERMS.orgManage);
  const input = createSchema.parse(await req.json());
  const { Zone, Area, Parish } = await getDb();
  let doc: any;
  if (input.type === "zone") {
    doc = await Zone.create({ name: input.name, nameKey: keyOf(input.name), hasAreas: input.hasAreas, description: input.description });
  } else if (input.type === "area") {
    const zone = await Zone.findById(input.zone).lean<any>();
    if (!zone) throw new ApiError(400, "That zone doesn't exist.");
    if (!zone.hasAreas) throw new ApiError(400, `"${zone.name}" is a standalone zone. Switch it to "has areas" first, or add parishes directly.`);
    doc = await Area.create({ name: input.name, nameKey: keyOf(input.name), zone: input.zone });
  } else {
    await validatePlacement(input.zone, input.area);
    doc = await Parish.create({ name: input.name, nameKey: keyOf(input.name), zone: input.zone, area: input.area || null, address: input.address });
  }
  await audit(user, `org.${input.type}.create`, input.name, undefined, req);
  return { id: String(doc._id) };
});

export const PATCH = handle(async (req) => {
  const user = await requireApiUser(PERMS.orgManage);
  const p = patchSchema.parse(await req.json());
  const { Zone, Area, Parish } = await getDb();

  if (p.type === "zone") {
    const zone = await Zone.findById(p.id);
    if (!zone) throw new ApiError(404, "Zone not found.");
    if (p.hasAreas !== undefined && p.hasAreas !== zone.hasAreas) {
      if (!p.hasAreas && (await Area.countDocuments({ zone: zone._id })) > 0)
        throw new ApiError(400, "This zone still has areas. Move or remove them before making it standalone.");
      if (p.hasAreas && (await Parish.countDocuments({ zone: zone._id, area: null })) > 0)
        throw new ApiError(400, "This zone has parishes directly under it. Create an area and transfer them before switching to 'has areas'.");
      zone.hasAreas = p.hasAreas;
    }
    if (p.name) { zone.name = p.name; zone.nameKey = keyOf(p.name); }
    if (p.active !== undefined) zone.active = p.active;
    if (p.description !== undefined) zone.description = p.description;
    await zone.save();
    await audit(user, "org.zone.update", zone.name, p, req);
    return { ok: true };
  }

  if (p.type === "area") {
    const area = await Area.findById(p.id);
    if (!area) throw new ApiError(404, "Area not found.");
    if (p.name) { area.name = p.name; area.nameKey = keyOf(p.name); }
    if (p.active !== undefined) area.active = p.active;
    await area.save();
    await audit(user, "org.area.update", area.name, p, req);
    return { ok: true };
  }

  const parish = await Parish.findById(p.id);
  if (!parish) throw new ApiError(404, "Parish not found.");
  if (p.name) { parish.name = p.name; parish.nameKey = keyOf(p.name); }
  if (p.active !== undefined) parish.active = p.active;
  if (p.address !== undefined) parish.address = p.address;
  if (p.zone !== undefined) {
    const newArea = p.area ?? null;
    await validatePlacement(p.zone, newArea);
    const moved = String(parish.zone) !== p.zone || String(parish.area ?? "") !== String(newArea ?? "");
    if (moved) {
      if (!p.reason?.trim()) throw new ApiError(400, "Please give a reason for transferring this parish.");
      parish.transfers.push({ by: user.id, fromZone: parish.zone, fromArea: parish.area, toZone: p.zone, toArea: newArea, reason: p.reason });
      parish.zone = p.zone as any;
      parish.area = newArea as any;
      await audit(user, "org.parish.transfer", parish.name, { to: { zone: p.zone, area: newArea }, reason: p.reason }, req);
    }
  }
  await parish.save();
  await audit(user, "org.parish.update", parish.name, undefined, req);
  return { ok: true };
});

export const DELETE = handle(async (req) => {
  const user = await requireApiUser(PERMS.orgManage);
  const url = new URL(req.url);
  const type = url.searchParams.get("type");
  const id = url.searchParams.get("id") || "";
  if (!mongoose.isValidObjectId(id)) throw new ApiError(400, "Invalid id.");
  const { Zone, Area, Parish, User } = await getDb();
  if (type === "zone") {
    if ((await Area.countDocuments({ zone: id })) + (await Parish.countDocuments({ zone: id })) > 0)
      throw new ApiError(409, "This zone still has areas or parishes. Deactivate it instead, or move them first.");
    await Zone.findByIdAndDelete(id);
  } else if (type === "area") {
    if ((await Parish.countDocuments({ area: id })) > 0) throw new ApiError(409, "This area still has parishes. Transfer them first, or deactivate the area.");
    await Area.findByIdAndDelete(id);
  } else if (type === "parish") {
    if ((await User.countDocuments({ parish: id })) > 0) throw new ApiError(409, "Users are assigned to this parish. Reassign them first, or deactivate the parish.");
    await Parish.findByIdAndDelete(id);
  } else throw new ApiError(400, "Unknown type.");
  await audit(user, `org.${type}.delete`, id, undefined, req);
  return { ok: true };
});
