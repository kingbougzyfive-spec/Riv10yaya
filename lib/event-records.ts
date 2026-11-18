import mongoose from "mongoose";
import { z } from "zod";
import { audit } from "./api";
import { chainFor } from "./admin-request";
import { ApiError } from "./auth";
import { getDb } from "./db";
import { toKobo } from "./money";
import { isScopedRole, inReach, reachFilter } from "./reach";
import type { Submitter } from "./remittance-submit";
import type { SessionUser } from "./auth";
import { isProvincial, ownedUnits } from "./scope";

export const EVENT_LEVELS = ["parish", "area", "zone", "province"] as const;
export type EventLevel = (typeof EVENT_LEVELS)[number];
const MAX_COUNT = 1_000_000;
const MAX_NAIRA = 10_000_000_000;

const text = (max: number) => z.string().trim().max(max).optional().default("");
/** Creating or editing an event record form (Super Administrator). The keys of the extra counts are made here and never change. */
export const formSchema = z.object({
  title: z.string().trim().min(3, "Give the event a name").max(120),
  description: text(600),
  eventDate: z.string().refine((v) => !Number.isNaN(Date.parse(v)), "Choose the date"),
  endDate: z.string().optional().default("").refine((v) => v === "" || !Number.isNaN(Date.parse(v)), "Choose a valid end date"),
  venue: text(120),
  level: z.enum(EVENT_LEVELS),
  collectOffering: z.boolean().default(true),
  customFields: z.array(z.object({ label: z.string().trim().min(2, "Name each extra count").max(60) })).max(8).default([]),
});

/** The numbers a unit fills in for one form. The total is never typed: it is always men + women. */
export function recordSchema(form: { collectOffering: boolean; customFields: { key: string; label: string }[] }) {
  const count = (label: string) => z.number({ message: `${label}: enter a number` }).int(`${label} must be a whole number`).min(0, `${label} can't be negative`).max(MAX_COUNT, `${label} is too large`);
  const extras: Record<string, z.ZodTypeAny> = {};
  for (const f of form.customFields) extras[f.key] = count(f.label);
  return z.object({
    males: count("Males"),
    females: count("Females"),
    ...(form.collectOffering ? { offering: z.number({ message: "Offering: enter an amount (0 if none)" }).min(0, "Offering can't be negative").max(MAX_NAIRA, "Offering is too large") } : {}),
    extras: z.object(extras).default({} as any),
    notes: text(600),
  });
}

export const keyFor = (i: number) => `f${i + 1}`;

/** The unit a record belongs to, with its parents, from the database. */
export async function unitOf(level: EventLevel, id?: string | null) {
  if (level === "province") return { type: level, zone: undefined as any, area: undefined as any, parish: undefined as any, name: "Whole province", key: "province" };
  if (!id || !mongoose.isValidObjectId(id)) throw new ApiError(400, `Choose the ${level}.`);
  const c = await chainFor(level, id);
  if (!c) throw new ApiError(400, `That ${level} doesn't exist.`);
  return { type: level, zone: c.zone._id, area: c.area?._id, parish: c.parish?._id, name: c.unit.name as string, key: `${level}:${id}` };
}

/** May this signed-in person fill in or change the record of this unit? (Provincial offices: any. Others: only units in their care.) */
export function mayFill(user: SessionUser, unit: { zone?: any; area?: any; parish?: any }) {
  if (user.role === "super_admin" || user.role === "provincial_admin") return true;
  return isScopedRole(user.role) && inReach(user, unit);
}

const view = (r: any, names?: Map<string, string>) => ({
  id: String(r._id), unitType: r.unitType, unitKey: r.unitKey, zone: r.zone ? String(r.zone) : "", area: r.area ? String(r.area) : "", parish: r.parish ? String(r.parish) : "",
  males: r.males, females: r.females, total: r.total, offeringKobo: r.offeringKobo ?? null, extras: r.extras ?? {}, notes: r.notes ?? "",
  by: r.filledBy?.name ? `${r.filledBy.name}${r.filledBy.phone ? ` · ${r.filledBy.phone}` : ""} (via link)` : r.submittedByName ?? "", via: r.via, updatedAt: r.updatedAt, createdAt: r.createdAt,
  history: (r.history ?? []).slice(-6), unitName: names?.get(r.unitKey) ?? "",
});

export async function saveEventRecord(a: { actor: Submitter; form: any; unit: Awaited<ReturnType<typeof unitOf>>; input: any; via: "app" | "link"; filledBy?: { name: string; phone: string }; req?: Request }) {
  const { form, unit, input, actor } = a;
  if (form.status !== "open") throw new ApiError(409, "This event form is closed, so records can no longer be changed.");
  if (form.level !== unit.type) throw new ApiError(400, `This event takes one record per ${form.level}.`);
  const { EventRecord } = await getDb();
  const males = Number(input.males), females = Number(input.females), total = males + females; // always worked out here
  const offeringKobo = form.collectOffering ? toKobo(input.offering ?? 0) : undefined;
  const extras: Record<string, number> = {};
  for (const f of form.customFields) extras[f.key] = Number(input.extras?.[f.key] ?? 0);
  const existing: any = await EventRecord.findOne({ form: form._id, unitKey: unit.key });
  const who = a.filledBy?.name ? `${a.filledBy.name} (via link from ${actor.byName.split("(via link from ")[1]?.replace(")", "") ?? "an administrator"})` : actor.byName;
  const entry = { at: new Date(), byName: who, action: existing ? "edited" : "created", note: existing ? `Was ${existing.males} men, ${existing.females} women (total ${existing.total})` : `${males} men, ${females} women` };
  const doc = existing ?? new EventRecord({ form: form._id, unitKey: unit.key, unitType: unit.type, zone: unit.zone, area: unit.area, parish: unit.parish });
  Object.assign(doc, { males, females, total, offeringKobo, extras, notes: input.notes || undefined, submittedBy: actor.id, submittedByName: actor.byName, via: a.via, filledBy: a.filledBy });
  doc.history = [...(doc.history ?? []), entry];
  await doc.save();
  await audit(actor.audit, existing ? "eventrecord.edit" : "eventrecord.create", `${form.title}: ${unit.name}`, { entity: "eventrecord", entityId: String(doc._id), before: existing ? { males: entry.note } : undefined, after: { males, females, total, offeringKobo, viaLink: a.via === "link" } }, a.req);
  return view(doc);
}

/** What a person can see and fill for one form: the records in their care, the units still to report, and the totals (which add up automatically). */
export async function formOverview(user: SessionUser, form: any) {
  const { EventRecord, Zone, Area, Parish } = await getDb();
  const wide = isProvincial(user) || user.role === "event_admin" || user.role === "auditor";
  let recFilter: Record<string, unknown> | null = {};
  if (!wide) recFilter = isScopedRole(user.role) ? reachFilter(user) : null;
  const recs: any[] = recFilter ? await EventRecord.find({ form: form._id, ...recFilter }).lean() : [];

  // Units expected to report at this form's level.
  let units: { id: string; type: EventLevel; name: string; zone: string; area: string; label: string }[] = [];
  if (form.level === "province") units = [{ id: "", type: "province", name: "Whole province", zone: "", area: "", label: "Whole province" }];
  else {
    const owned = wide ? null : await ownedUnits(user);
    const M = form.level === "zone" ? Zone : form.level === "area" ? Area : Parish;
    const ids = owned ? owned[({ zone: "zones", area: "areas", parish: "parishes" } as const)[form.level as "zone" | "area" | "parish"]] : null;
    const docs: any[] = ids && !ids.length ? [] : await M.find({ ...(ids ? { _id: { $in: ids } } : {}), active: true }, { name: 1, zone: 1, area: 1 }).lean();
    const [zn, an] = await Promise.all([Zone.find({}, { name: 1 }).lean<any[]>(), Area.find({}, { name: 1 }).lean<any[]>()]);
    const zmap = new Map(zn.map((x) => [String(x._id), x.name])), amap = new Map(an.map((x) => [String(x._id), x.name]));
    units = docs.map((d) => ({ id: String(d._id), type: form.level, name: d.name, zone: d.zone ? zmap.get(String(d.zone)) ?? "" : "", area: d.area ? amap.get(String(d.area)) ?? "" : "",
      label: [d.name, [form.level === "parish" ? amap.get(String(d.area)) : "", form.level !== "zone" ? zmap.get(String(d.zone ?? d._id)) : ""].filter(Boolean).join(", ")].filter(Boolean).join(form.level === "zone" ? "" : " (") + (form.level === "zone" ? "" : ")") }))
      .sort((x, y) => x.label.localeCompare(y.label, undefined, { numeric: true }));
  }
  const byKey = new Map(recs.map((r) => [r.unitKey, r]));
  const rows = units.map((u) => ({ ...u, record: byKey.get(u.type === "province" ? "province" : `${u.type}:${u.id}`) ? view(byKey.get(u.type === "province" ? "province" : `${u.type}:${u.id}`)) : null }));
  const sum = (f: (r: any) => number) => recs.reduce((n, r) => n + f(r), 0);
  const extras: Record<string, number> = {};
  for (const f of form.customFields) extras[f.key] = sum((r) => Number(r.extras?.[f.key] ?? 0));
  return {
    units: rows,
    totals: { males: sum((r) => r.males), females: sum((r) => r.females), total: sum((r) => r.total), offeringKobo: form.collectOffering ? sum((r) => r.offeringKobo ?? 0) : null, extras, reported: recs.length, expected: units.length },
  };
}
