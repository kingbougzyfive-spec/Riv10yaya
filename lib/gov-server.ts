import { z } from "zod";
import mongoose from "mongoose";
import { ApiError, type SessionUser } from "./auth";
import { getDb } from "./db";
import { canManage, canView, LEVELS, memberWithin, orgComplete, visibleFilter, type GLevel, type Org } from "./governance";
import { keysOf } from "./member-store";
import { notifyUsers } from "./notify";

export const orgInput = z.object({ level: z.enum(LEVELS), zone: z.string().optional(), area: z.string().optional(), parish: z.string().optional() });
const oid = (v?: string) => (v && mongoose.isValidObjectId(v) ? v : "");

/**
 * Builds the organisational address of a new record. The ancestry is read from the database (parish → area → zone),
 * so a client can never attach a record to a mismatched hierarchy. The caller must be allowed to manage that level.
 */
export async function resolveOrg(user: SessionUser, i: z.infer<typeof orgInput>): Promise<Org & { zone: any; area: any; parish: any }> {
  const { Zone, Area, Parish } = await getDb();
  const o: any = { level: i.level as GLevel, zone: null, area: null, parish: null };
  if (i.level === "parish") {
    const p = await Parish.findById(oid(i.parish)).lean<any>();
    if (!p) throw new ApiError(400, "Choose a parish.");
    o.parish = p._id; o.area = p.area ?? null; o.zone = p.zone;
  } else if (i.level === "area") {
    const a = await Area.findById(oid(i.area)).lean<any>();
    if (!a) throw new ApiError(400, "Choose an area.");
    o.area = a._id; o.zone = a.zone;
  } else if (i.level === "zone") {
    const z = await Zone.findById(oid(i.zone)).lean<any>();
    if (!z) throw new ApiError(400, "Choose a zone.");
    o.zone = z._id;
  }
  if (!orgComplete({ level: o.level, zone: o.zone && String(o.zone), area: o.area && String(o.area), parish: o.parish && String(o.parish) })) throw new ApiError(400, "Incomplete organisation details.");
  if (!canManage(user, orgOf(o))) throw new ApiError(403, "That level or place is outside your responsibility.");
  return o;
}

export const orgOf = (d: any): Org => ({ level: d.level, zone: d.zone ? String(d.zone) : null, area: d.area ? String(d.area) : null, parish: d.parish ? String(d.parish) : null });
export const orgOut = (d: any, n: { zone: Map<string, string>; area: Map<string, string>; parish: Map<string, string> }) => ({ level: d.level, zoneId: d.zone ? String(d.zone) : null, areaId: d.area ? String(d.area) : null, parishId: d.parish ? String(d.parish) : null, place: d.level === "province" ? "Province" : [n.zone.get(String(d.zone)), d.area ? n.area.get(String(d.area)) : "", d.parish ? n.parish.get(String(d.parish)) : ""].filter(Boolean).join(" → ") });

/** Query filter for list endpoints: the user's visibility, plus optional narrowing by level and place. Never wider than visibility. */
export function listFilter(user: SessionUser, q: URLSearchParams) {
  const vis = visibleFilter(user);
  if (vis === null) throw new ApiError(403, "No access.");
  const f: any = { ...vis };
  const lv = q.get("level");
  if (lv && (LEVELS as readonly string[]).includes(lv)) f.level = lv;
  for (const k of ["zone", "area", "parish"]) { const v = oid(q.get(k) ?? ""); if (v && !(f[k] && String(f[k]) !== v)) f[k] = v; else if (v) f[k] = "000000000000000000000000"; }
  return f;
}

/** Loads a record the user may at least view (404 otherwise); `manage` additionally requires management rights (403). */
export async function loadGov(model: "Appointment" | "Committee" | "Task" | "Meeting" | "GovDocument" | "Department", id: string, user: SessionUser, manage: boolean) {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(404, "Not found.");
  const doc = await (await getDb())[model].findById(id);
  if (!doc || !canView(user, orgOf(doc))) throw new ApiError(404, "Not found.");
  if (manage && !canManage(user, orgOf(doc))) throw new ApiError(403, "You can view this but not change it.");
  return doc;
}

/** A member who may be placed in this organisation (they must belong to it, and be inside the caller's reach). */
export async function pickMember(user: SessionUser, org: Org, memberId: string) {
  if (!mongoose.isValidObjectId(memberId)) throw new ApiError(400, "Choose a member.");
  const m = await (await getDb()).Member.findById(memberId);
  if (!m || !canView(user, { level: "parish", zone: String(m.zone), area: m.area ? String(m.area) : null, parish: String(m.parish) })) throw new ApiError(404, "Member not found.");
  if (!memberWithin(org, m)) throw new ApiError(422, `${m.name} doesn't belong to this ${org.level}.`);
  return m;
}

/** Tell the member (if they have a sign-in) about something assigned to them. */
export async function notifyMember(m: any, n: { title: string; body?: string; link?: string; event?: string }) {
  try {
    const { User } = await getDb();
    const us = await User.find({ role: "member", phone: { $in: keysOf(m) }, active: true }, { _id: 1 }).lean<any[]>();
    await notifyUsers(us.map((u) => String(u._id)), n);
  } catch { /* never block the action */ }
}
export const dateStr = z.string().refine((v) => !Number.isNaN(Date.parse(v)), "Enter a valid date");
export const names = async () => (await import("./names")).orgNames();
