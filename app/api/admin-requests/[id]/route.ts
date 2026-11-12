import mongoose from "mongoose";
import { z } from "zod";
import { audit, handle, keyOf } from "@/lib/api";
import { ApiError, requireApiUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { sendMail } from "@/lib/mail";
import { PERMS } from "@/lib/rbac";

export const dynamic = "force-dynamic";
const schema = z.object({ action: z.enum(["approve", "reject"]), reason: z.string().trim().max(300).optional() });
const ROLE = { zone: "zonal_admin", area: "area_admin", parish: "parish_admin" } as const;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

export const PATCH = handle(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const actor = await requireApiUser(PERMS.users);
  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) throw new ApiError(404, "Not found");
  const i = schema.parse(await req.json());
  const { AdminRequest, Zone, Area, Parish, User } = await getDb();
  const r: any = await AdminRequest.findById(id);
  if (!r) throw new ApiError(404, "Not found");
  if (r.status !== "pending") throw new ApiError(409, `This request was already ${r.status}.`);
  const site = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;

  if (i.action === "reject") {
    r.status = "rejected"; r.reason = i.reason || ""; r.reviewedBy = actor.name; r.reviewedAt = new Date();
    await r.save();
    await audit(actor, "adminrequest.reject", r.email, { entity: "adminrequest", entityId: id, reason: i.reason }, req);
    await sendMail({ to: r.email, subject: "Your administrator registration", html: `<p>Hello ${esc(r.name)},</p><p>Your request for an administrator account was not approved${i.reason ? `: ${esc(i.reason)}` : ""}.</p><p>Please contact the Super Administrator if you think this is a mistake.</p>` }).catch(() => {});
    return { ok: true, status: "rejected" };
  }

  if (await User.exists({ email: r.email })) throw new ApiError(409, "That email already has an account. Reject this request instead.");
  const name = (r.orgName || "").trim();
  let zoneId = r.zone ? String(r.zone) : "", areaId: string | null = r.area ? String(r.area) : null, parishId: string | null = null;

  // Use the organisation they picked, or create the one they typed (re-using an existing record with the same name).
  if (r.level === "zone") {
    if (!zoneId) {
      const z = (await Zone.findOne({ nameKey: keyOf(name) })) || (await Zone.create({ name, nameKey: keyOf(name), hasAreas: true }));
      zoneId = String(z._id);
    }
    areaId = null;
  } else {
    const zone: any = await Zone.findById(zoneId).lean();
    if (!zone) throw new ApiError(400, "Their zone no longer exists.");
    if (r.level === "area") {
      if (!zone.hasAreas) throw new ApiError(400, `"${zone.name}" has no areas, so an area administrator can't be linked to it.`);
      if (!areaId) {
        const a = (await Area.findOne({ zone: zoneId, nameKey: keyOf(name) })) || (await Area.create({ name, nameKey: keyOf(name), zone: zoneId }));
        areaId = String(a._id);
      }
    } else {
      if (zone.hasAreas && !areaId) throw new ApiError(400, "This parish's area is missing. Reject the request and ask them to register again.");
      if (!zone.hasAreas) areaId = null;
      if (r.parish) parishId = String(r.parish);
      else {
        const p = (await Parish.findOne({ zone: zoneId, area: areaId, nameKey: keyOf(name) })) || (await Parish.create({ name, nameKey: keyOf(name), zone: zoneId, area: areaId }));
        parishId = String(p._id);
      }
    }
  }

  const role = ROLE[r.level as keyof typeof ROLE];
  const u = await User.create({
    name: r.name, email: r.email, phone: r.phone || undefined, role, passwordHash: r.passwordHash,
    zone: zoneId, area: r.level === "zone" ? undefined : areaId || undefined, parish: parishId || undefined,
    mustChangePassword: false, // they chose this password themselves
  });
  r.status = "approved"; r.reviewedBy = actor.name; r.reviewedAt = new Date(); r.userId = u._id;
  await r.save();
  await audit(actor, "adminrequest.approve", r.email, { entity: "adminrequest", entityId: id, after: { role, organisation: name } }, req);
  await sendMail({ to: r.email, subject: "Your administrator account is ready", html: `<p>Hello ${esc(r.name)},</p><p>Your account has been approved. You can now sign in at <a href="${site}/login">${site}/login</a> with the email and password you registered with.</p>` }).catch(() => {});
  return { ok: true, status: "approved", role };
});
