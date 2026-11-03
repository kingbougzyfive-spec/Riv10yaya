import { z } from "zod";
import { handle, audit } from "@/lib/api";
import { ApiError, requireApiUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { PERMS } from "@/lib/rbac";

export const dynamic = "force-dynamic";

/** Door check-in by scanned ticket (reference). The event must match, so a ticket for another event is refused. */
export const POST = handle(async (req) => {
  const user = await requireApiUser(PERMS.attendance);
  const { code, eventId } = z.object({ code: z.string().min(4).max(60), eventId: z.string() }).parse(await req.json());
  const ref = code.replace(/^YAYA-REG:/i, "").trim().toUpperCase();
  const { Registration } = await getDb();
  const r = await Registration.findOne({ reference: ref });
  if (!r) throw new ApiError(404, "Ticket not recognised.");
  if (String(r.event) !== eventId) throw new ApiError(409, "This ticket is for a different event.");
  if (r.status !== "registered") throw new ApiError(409, "This registration was cancelled.");
  if (r.checkedInAt) return { ok: true, already: true, name: r.name, at: r.checkedInAt };
  r.checkedInAt = new Date();
  r.checkedInBy = user.id as any;
  await r.save();
  await audit(user, "registration.checkin_scan", r.reference, undefined, req);
  return { ok: true, already: false, name: r.name, at: r.checkedInAt };
});
