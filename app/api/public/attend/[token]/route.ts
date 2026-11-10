import { z } from "zod";
import { handle } from "@/lib/api";
import { ApiError } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { distanceM, phoneKey, validPhone } from "@/lib/ids";
import { HOUR, MIN, rateLimit } from "@/lib/ratelimit";
import { orgNames } from "@/lib/names";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ token: string }> };

async function find(token: string) {
  const { AttendanceSession } = await getDb();
  const s = await AttendanceSession.findOne({ token }).lean<any>();
  if (!s) throw new ApiError(404, "This QR code isn't valid any more. Ask the organiser for the current one.");
  return s;
}
const stateOf = (s: any) => { const now = Date.now(); return s.forceClosed ? "closed" : now < +new Date(s.opensAt) ? "scheduled" : now > +new Date(s.closesAt) ? "closed" : "open"; };

export const GET = handle<Ctx>(async (_req, ctx) => {
  const s = await find((await ctx.params).token);
  const n = await orgNames();
  return { title: s.title, description: s.description, level: s.level, state: stateOf(s), opensAt: s.opensAt, closesAt: s.closesAt, wantsLocation: !!s.locationCheck?.enabled, where: [s.zone && n.zone.get(String(s.zone)), s.area && n.area.get(String(s.area)), s.parish && n.parish.get(String(s.parish))].filter(Boolean).join(" → ") };
});

const schema = z.object({
  mode: z.enum(["member", "visitor"]),
  identifier: z.string().trim().max(60).optional(),
  name: z.string().trim().min(2).max(100).optional(), phone: z.string().trim().optional(),
  lat: z.number().optional(), lng: z.number().optional(),
});

/** Marks attendance. Time is the server's clock; duplicates are blocked by a unique index. QR scan alone isn't proof of presence: location is an optional extra signal. */
export const POST = handle<Ctx>(async (req, ctx) => {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  await rateLimit(`att:${ip}`, 12, MIN, "Too many attempts. Please wait a minute.");
  const s = await find((await ctx.params).token);
  const st = stateOf(s);
  if (st === "scheduled") throw new ApiError(409, `Attendance opens at ${new Date(s.opensAt).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })}.`);
  if (st === "closed") throw new ApiError(409, "Attendance for this session has closed.");
  const i = schema.parse(await req.json());
  const { Member, Attendance, Registration } = await getDb();

  let who: { name: string; key: string; visitor: boolean; member?: any; zone?: any; area?: any; parish?: any };
  if (i.mode === "member") {
    const id = (i.identifier ?? "").trim();
    if (!id) throw new ApiError(422, "Enter your member ID or registered phone number.");
    const m = /^YM-/i.test(id) ? await Member.findOne({ memberId: id.toUpperCase(), active: true }).lean<any>() : validPhone(id) ? await Member.findOne({ phoneKey: phoneKey(id), active: true }).lean<any>() : null;
    if (!m) throw new ApiError(404, "We couldn't find a member with those details. Check them, or sign in as a visitor.");
    who = { name: m.name, key: m.phoneKey, visitor: false, member: m._id, zone: m.zone, area: m.area, parish: m.parish };
  } else {
    if (!i.name || !i.phone || !validPhone(i.phone)) throw new ApiError(422, "Enter your full name and a valid phone number.");
    who = { name: i.name, key: phoneKey(i.phone), visitor: true, zone: s.zone, area: s.area, parish: s.parish };
  }

  let location: any = { provided: false };
  if (s.locationCheck?.enabled && typeof i.lat === "number" && typeof i.lng === "number") {
    const d = distanceM(i.lat, i.lng, s.locationCheck.lat, s.locationCheck.lng);
    location = { provided: true, distanceM: Math.round(d), withinRadius: d <= (s.locationCheck.radiusM ?? 300) };
  }
  const reg = s.event ? await Registration.findOne({ event: s.event, phoneKey: who.key }, { _id: 1 }).lean<any>() : null;
  try {
    const rec = await Attendance.create({ session: s._id, member: who.member, registration: reg?._id, name: who.name, phoneKey: who.key, visitor: who.visitor, zone: who.zone, area: who.area, parish: who.parish, method: "qr", location });
    if (reg) await Registration.updateOne({ _id: reg._id, checkedInAt: { $exists: false } }, { $set: { checkedInAt: rec.at } });
    return { ok: true, name: who.name, at: rec.at };
  } catch (e: any) {
    if (e?.code === 11000) throw new ApiError(409, `${who.name.split(" ")[0]}, you're already marked present. Thank you!`);
    throw e;
  }
});
