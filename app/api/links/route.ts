import mongoose from "mongoose";
import { z } from "zod";
import { audit, handle } from "@/lib/api";
import { ApiError, requireApiUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { EXPIRY_DAYS, hashLinkPassword, newPassword, newToken, stateOf } from "@/lib/fill-links";
import { MONTHS } from "@/lib/money";
import { inReach } from "@/lib/reach";
import { PERMS } from "@/lib/rbac";
import { isProvincial } from "@/lib/scope";

export const dynamic = "force-dynamic";
const oid = z.string().refine((v) => mongoose.isValidObjectId(v), "Invalid choice");
const createSchema = z.object({
  purpose: z.enum(["monthly", "event"]),
  unit: z.object({ type: z.enum(["parish", "area", "zone", "province"]), id: oid.optional() }),
  month: z.number().int().min(1).max(12).optional(),
  year: z.number().int().min(2020).max(2100).optional(),
  eventForm: oid.optional(),
  label: z.string().trim().max(80).optional().default(""),
  expiresInDays: z.number().int().refine((n) => (EXPIRY_DAYS as readonly number[]).includes(n), "Choose how long the link lasts").default(7),
  password: z.string().trim().min(6, "The password must be at least 6 characters").max(40).optional(),
});
const patchSchema = z.object({ id: oid, action: z.enum(["revoke", "reset_password", "extend"]), days: z.number().int().min(1).max(30).optional() });

/** What each kind of administrator may make a link for (always inside the units they are in charge of). */
const LEVELS: Record<string, string[]> = { parish_admin: ["parish"], area_admin: ["parish", "area"], zonal_admin: ["parish", "area", "zone"], provincial_admin: ["parish", "area", "zone", "province"], super_admin: ["parish", "area", "zone", "province"] };

export const GET = handle(async () => {
  const user = await requireApiUser(PERMS.fillLinks);
  const { FillLink, Zone, Area, Parish, EventForm } = await getDb();
  const rows = await FillLink.find(isProvincial(user) ? {} : { createdBy: user.id }).sort({ createdAt: -1 }).limit(200).lean<any[]>();
  const nm = async (M: any, ids: any[]) => new Map((await M.find({ _id: { $in: ids.filter(Boolean) } }, { name: 1, title: 1 }).lean()).map((x: any) => [String(x._id), x.name ?? x.title]));
  const [zn, an, pn, en] = await Promise.all([nm(Zone, rows.map((r) => r.zone)), nm(Area, rows.map((r) => r.area)), nm(Parish, rows.map((r) => r.parish)), nm(EventForm, rows.map((r) => r.eventForm))]);
  return {
    links: rows.map((r) => ({
      id: String(r._id), path: `/f/${r.token}`, purpose: r.purpose, unitType: r.unitType, label: r.label ?? "",
      unit: r.unitType === "parish" ? pn.get(String(r.parish)) : r.unitType === "area" ? an.get(String(r.area)) : r.unitType === "zone" ? zn.get(String(r.zone)) : "Whole province",
      zone: r.zone ? zn.get(String(r.zone)) : "", area: r.area ? an.get(String(r.area)) : "",
      period: r.purpose === "monthly" ? `${MONTHS[r.month - 1]} ${r.year}` : "", event: r.eventForm ? en.get(String(r.eventForm)) ?? "" : "",
      state: stateOf(r), createdByName: r.createdByName, createdAt: r.createdAt, expiresAt: r.expiresAt, opens: r.opens ?? 0, lastOpenedAt: r.lastOpenedAt,
      lastFilledBy: r.lastFilledBy?.name ? `${r.lastFilledBy.name}${r.lastFilledBy.phone ? ` · ${r.lastFilledBy.phone}` : ""}` : "",
      remittanceAt: r.remittanceAt, reportAt: r.reportAt, recordAt: r.recordAt, mine: String(r.createdBy) === user.id,
    })),
  };
});

export const POST = handle(async (req) => {
  const user = await requireApiUser(PERMS.fillLinks);
  const i = createSchema.parse(await req.json());
  const { Zone, Area, Parish, FillLink, EventForm } = await getDb();
  if (!LEVELS[user.role].includes(i.unit.type)) throw new ApiError(403, "You can't make a link for that level.");

  // Work out the unit and its parents from the database, then check it is in their care.
  let chain: { zone?: any; area?: any; parish?: any } = {};
  if (i.unit.type === "province") { if (!isProvincial(user)) throw new ApiError(403, "Only the province office can make a province-wide link."); }
  else {
    if (!i.unit.id) throw new ApiError(400, `Choose the ${i.unit.type}.`);
    if (i.unit.type === "zone") { const z: any = await Zone.findOne({ _id: i.unit.id, active: true }, { _id: 1 }).lean(); if (!z) throw new ApiError(400, "That zone doesn't exist."); chain = { zone: z._id }; }
    if (i.unit.type === "area") { const a: any = await Area.findOne({ _id: i.unit.id, active: true }, { zone: 1 }).lean(); if (!a) throw new ApiError(400, "That area doesn't exist."); chain = { zone: a.zone, area: a._id }; }
    if (i.unit.type === "parish") { const p: any = await Parish.findOne({ _id: i.unit.id, active: true }, { zone: 1, area: 1 }).lean(); if (!p) throw new ApiError(400, "That parish doesn't exist."); chain = { zone: p.zone, area: p.area ?? undefined, parish: p._id }; }
    if (!isProvincial(user) && !inReach(user, chain)) throw new ApiError(403, "That isn't in your care.");
  }

  let month: number | undefined, year: number | undefined, eventForm: any;
  if (i.purpose === "monthly") {
    if (i.unit.type === "province") throw new ApiError(400, "Monthly forms are for a parish, area or zone.");
    const now = new Date();
    month = i.month ?? now.getMonth() + 1; year = i.year ?? now.getFullYear();
    if (year * 12 + month > now.getFullYear() * 12 + now.getMonth() + 1) throw new ApiError(400, "You can't make a link for a month that hasn't started.");
  } else {
    const f: any = i.eventForm ? await EventForm.findById(i.eventForm).lean() : null;
    if (!f) throw new ApiError(400, "Choose the event form.");
    if (f.status !== "open") throw new ApiError(400, "That event form is closed.");
    if (f.level !== i.unit.type) throw new ApiError(400, `That event takes one record per ${f.level}.`);
    eventForm = f._id;
  }

  const token = newToken();
  const password = i.password ?? newPassword();
  const link = await FillLink.create({
    token, passwordHash: await hashLinkPassword(password), purpose: i.purpose, unitType: i.unit.type, ...chain, month, year, eventForm,
    label: i.label, createdBy: user.id, createdByName: user.name, expiresAt: new Date(Date.now() + i.expiresInDays * 86_400_000),
  });
  await audit(user, "filllink.create", i.label || `${i.purpose} ${i.unit.type}`, { entity: "filllink", entityId: String(link._id), after: { purpose: i.purpose, unitType: i.unit.type, month, year, expiresInDays: i.expiresInDays } }, req);
  // The password is shown this once and never stored in a readable form.
  return { id: String(link._id), path: `/f/${token}`, password, expiresAt: link.expiresAt };
});

export const PATCH = handle(async (req) => {
  const user = await requireApiUser(PERMS.fillLinks);
  const i = patchSchema.parse(await req.json());
  const { FillLink } = await getDb();
  const link: any = await FillLink.findById(i.id);
  if (!link || (String(link.createdBy) !== user.id && !isProvincial(user))) throw new ApiError(404, "Link not found.");
  if (i.action === "revoke") {
    link.revokedAt = new Date(); await link.save();
    await audit(user, "filllink.revoke", link.label || String(link._id), { entity: "filllink", entityId: String(link._id) }, req);
    return { ok: true };
  }
  if (i.action === "extend") {
    link.expiresAt = new Date(Math.max(Date.now(), +link.expiresAt) + (i.days ?? 7) * 86_400_000); link.revokedAt = undefined; await link.save();
    await audit(user, "filllink.extend", link.label || String(link._id), { entity: "filllink", entityId: String(link._id) }, req);
    return { ok: true, expiresAt: link.expiresAt };
  }
  const password = newPassword();
  link.passwordHash = await hashLinkPassword(password); link.passwordVersion = (link.passwordVersion ?? 0) + 1; link.failedAttempts = 0; link.lockedUntil = undefined; await link.save();
  await audit(user, "filllink.reset_password", link.label || String(link._id), { entity: "filllink", entityId: String(link._id) }, req);
  return { ok: true, password };
});
