import { z } from "zod";
import { handle, audit } from "@/lib/api";
import { ApiError, requireApiUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { PERMS } from "@/lib/rbac";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** Check a registrant in (or undo). Staff only; the time is recorded by the server. */
export const PATCH = handle<Ctx>(async (req, ctx) => {
  const user = await requireApiUser(PERMS.attendance);
  const { id } = await ctx.params;
  const { checkedIn } = z.object({ checkedIn: z.boolean() }).parse(await req.json());
  const { Registration } = await getDb();
  const r = await Registration.findById(id);
  if (!r) throw new ApiError(404, "Registration not found.");
  r.checkedInAt = checkedIn ? new Date() : undefined;
  r.checkedInBy = checkedIn ? (user.id as any) : undefined;
  await r.save();
  await audit(user, checkedIn ? "registration.checkin" : "registration.undo_checkin", r.reference, undefined, req);
  return { ok: true };
});
