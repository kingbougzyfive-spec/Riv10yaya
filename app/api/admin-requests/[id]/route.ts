import mongoose from "mongoose";
import { z } from "zod";
import { audit, handle, keyOf } from "@/lib/api";
import { ApiError, requireApiUser } from "@/lib/auth";
import { matchTyped } from "@/lib/admin-request";
import { getDb } from "@/lib/db";
import { sendMail } from "@/lib/mail";
import { PERMS } from "@/lib/rbac";

export const dynamic = "force-dynamic";
const oid = z.string().refine((v) => mongoose.isValidObjectId(v), "Invalid id").optional();
const schema = z.object({ action: z.enum(["approve", "reject"]), reason: z.string().trim().max(300).optional(), zone: oid, area: oid, parish: oid });
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
  const zoneName = r.zoneName || "", areaName = r.areaName || "", parishName = r.parishName || "";
  const m = await matchTyped({ level: r.level, zoneName, areaName, parishName, zone: r.zone, area: r.area, parish: r.parish }, { zone: i.zone, area: i.area, parish: i.parish });
  const name = (r.orgName || "").trim();
  if (i.zone && !m.zone) throw new ApiError(400, "The zone you chose doesn't exist.");
  if (i.area && !m.area) throw new ApiError(400, "The area you chose isn't in that zone.");
  if (i.parish && !m.parish) throw new ApiError(400, "The parish you chose isn't in that zone or area.");

  // Use what matched (or what the Super Administrator linked), and create whatever is new.
  let zone: any = m.zone, area: any = m.area, parish: any = m.parish;
  if (!zone) {
    if (zoneName.length < 2) throw new ApiError(400, "This request has no zone name.");
    // A new zone has areas when they typed an area, or when they lead an area; a parish with no area means a standalone zone.
    zone = await Zone.create({ name: zoneName, nameKey: keyOf(zoneName), hasAreas: r.level === "zone" ? true : !!areaName });
  }
  if (r.level !== "zone" && zone.hasAreas && !area) {
    if (areaName.length < 2) throw new ApiError(400, "This parish's area name is missing. Reject the request and ask them to register again.");
    area = await Area.create({ name: areaName, nameKey: keyOf(areaName), zone: zone._id });
  }
  if (r.level === "area" && !zone.hasAreas) throw new ApiError(400, `"${zone.name}" has no areas, so an area administrator can't be linked to it.`);
  if (r.level === "parish" && !parish) {
    if (parishName.length < 2) throw new ApiError(400, "This request has no parish name.");
    parish = await Parish.create({ name: parishName, nameKey: keyOf(parishName), zone: zone._id, area: zone.hasAreas ? area._id : null });
  }
  const zoneId = String(zone._id), areaId = area && zone.hasAreas ? String(area._id) : null, parishId = parish ? String(parish._id) : null;

  const role = ROLE[r.level as keyof typeof ROLE];
  const u = await User.create({
    name: r.name, email: r.email, phone: r.phone || undefined, role, passwordHash: r.passwordHash,
    zone: zoneId, area: r.level === "zone" ? undefined : areaId || undefined, parish: r.level === "parish" ? parishId || undefined : undefined,
    mustChangePassword: false, // they chose this password themselves
  });
  r.status = "approved"; r.reviewedBy = actor.name; r.reviewedAt = new Date(); r.userId = u._id;
  await r.save();
  await audit(actor, "adminrequest.approve", r.email, { entity: "adminrequest", entityId: id, after: { role, organisation: name } }, req);
  await sendMail({ to: r.email, subject: "Your administrator account is ready", html: `<p>Hello ${esc(r.name)},</p><p>Your account has been approved. You can now sign in at <a href="${site}/login">${site}/login</a> with the email and password you registered with.</p>` }).catch(() => {});
  return { ok: true, status: "approved", role };
});
