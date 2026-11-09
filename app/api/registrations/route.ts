import { handle } from "@/lib/api";
import { ApiError, requireApiUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { PERMS } from "@/lib/rbac";
import { orgNames } from "@/lib/names";
import { clampScope, recordScope } from "@/lib/scope";
import { asFormat, tableResponse } from "@/lib/export";

export const dynamic = "force-dynamic";

/** Registration list with search, org filters and CSV export (opens in Excel). Scoped: zonal/area/parish admins see only their own people. */
export const GET = handle(async (req) => {
  const user = await requireApiUser(PERMS.attendanceView);
  const scope = user.role === "event_admin" ? {} : await recordScope(user); // event administrators manage every event's registrations
  if (scope === null) throw new ApiError(403, "No access.");
  const q = new URL(req.url).searchParams;
  const eventId = q.get("eventId");
  if (!eventId) throw new ApiError(400, "Choose an event.");
  const f: any = { ...clampScope(scope, q), event: eventId, status: "registered" };
  const s = q.get("q")?.trim();
  if (s) { const rx = new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"); f.$or = [{ name: rx }, { phone: rx }, { reference: rx }]; }
  const { Registration, Event } = await getDb();
  const [rows, ev, n] = await Promise.all([Registration.find(f).sort({ createdAt: -1 }).limit(2000).lean<any[]>(), Event.findById(eventId).lean<any>(), orgNames()]);
  const out = rows.map((r) => ({
    id: String(r._id), reference: r.reference, regId: r.regId, name: r.name, phone: r.phone, email: r.email,
    zone: r.zone ? n.zone.get(String(r.zone)) : "", area: r.area ? n.area.get(String(r.area)) : "", parish: r.parish ? n.parish.get(String(r.parish)) : "",
    answers: r.answers ?? {}, checkedInAt: r.checkedInAt, createdAt: r.createdAt,
  }));
  if (q.get("format")) {
    const keys: string[] = (ev?.customFields ?? []).map((c: any) => c.key);
    const head = ["Reference", "Registration ID", "Name", "Phone", "Email", "Zone", "Area", "Parish", ...(ev?.customFields ?? []).map((c: any) => c.label), "Registered", "Checked in"];
    const rows = out.map((r) => [r.reference, r.regId, r.name, r.phone, r.email, r.zone, r.area, r.parish, ...keys.map((k) => r.answers[k]), new Date(r.createdAt).toISOString().slice(0, 16).replace("T", " "), r.checkedInAt ? "Yes" : "No"]);
    return tableResponse(asFormat(q.get("format")), { name: `registrations-${eventId}`, title: `Attendee list: ${ev?.title ?? "Event"}`, head, rows, pdfOmit: ["Registration ID", "Email"] });
  }
  return { rows: out, total: out.length, attended: out.filter((r) => r.checkedInAt).length, capacity: ev?.capacity ?? 0 };
});
