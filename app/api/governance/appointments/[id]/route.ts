import { z } from "zod";
import { handle, audit } from "@/lib/api";
import { ApiError, requireApiUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { PERMS } from "@/lib/rbac";
import { dateStr, loadGov, notifyMember } from "@/lib/gov-server";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("update"), position: z.string().trim().min(2).max(100).optional(), responsibilities: z.array(z.string().trim().min(2).max(300)).max(20).optional(), endsAt: dateStr.optional() }),
  z.object({ action: z.literal("end"), reason: z.string().trim().min(2).max(300) }),
]);

export const PATCH = handle<Ctx>(async (req, ctx) => {
  const user = await requireApiUser(PERMS.governanceManage);
  const a = await loadGov("Appointment", (await ctx.params).id, user, true);
  const i = body.parse(await req.json());
  const now = new Date();
  const { Member } = await getDb();
  if (i.action === "update") {
    if (a.status === "ended") throw new ApiError(409, "This appointment has ended.");
    const notes: string[] = [];
    if (i.position && i.position !== a.position) { notes.push(`title: ${a.position} → ${i.position}`); a.position = i.position; }
    if (i.responsibilities) { a.responsibilities = i.responsibilities; notes.push("responsibilities updated"); }
    if (i.endsAt) { a.endsAt = new Date(i.endsAt); notes.push("term end set"); }
    a.history.push({ at: now, by: user.id, byName: user.name, action: "updated", note: notes.join("; ") });
    await a.save();
    if (a.member && !a.department && i.position) await Member.updateOne({ _id: a.member }, { $set: { "leadership.title": a.position } });
  } else {
    a.status = "ended"; a.endedAt = now; a.endedReason = i.reason;
    a.history.push({ at: now, by: user.id, byName: user.name, action: "ended", note: i.reason });
    await a.save();
    if (a.member && !a.department) {
      const m = await Member.findById(a.member);
      // Clear the CRM title only if it still reflects this appointment (they may have since taken another).
      if (m && m.leadership?.title === a.position) { m.changes.push({ at: now, by: user.id, byName: user.name, field: "leadership", from: a.position, to: "", reason: i.reason }); m.leadership = { title: "", level: "" }; await m.save(); }
      if (m) await notifyMember(m, { title: `Your role as ${a.position} has ended`, body: i.reason });
    }
  }
  await audit(user, `appointment.${i.action}`, `${a.position}: ${a.holderName}`, undefined, req);
  return { ok: true };
});
