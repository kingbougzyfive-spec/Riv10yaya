import { handle, audit } from "@/lib/api";
import { ApiError, getUser, requireApiUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { canView } from "@/lib/governance";
import { PERMS } from "@/lib/rbac";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** Public: images are used on the public site. Cached hard; ids are unguessable ObjectIds. */
export const GET = handle<Ctx>(async (_req, ctx) => {
  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) throw new ApiError(404, "Not found");
  const { Media } = await getDb();
  const m = await Media.findById(id).lean<any>();
  if (!m) throw new ApiError(404, "Not found");
  if (m.document) {
    // Governance documents follow organisational permissions: you must be an administrator of that level or above it.
    const u = await getUser();
    if (!u) throw new ApiError(401, "Please sign in.");
    if (!canView(u, { level: m.docOrg?.level ?? "province", zone: m.docOrg?.zone ? String(m.docOrg.zone) : null, area: m.docOrg?.area ? String(m.docOrg.area) : null, parish: m.docOrg?.parish ? String(m.docOrg.parish) : null })) throw new ApiError(403, "You don't have access to this document.");
    const buf: Buffer = Buffer.isBuffer(m.data) ? m.data : Buffer.from(m.data.buffer);
    const inline = m.mime === "application/pdf" || m.mime.startsWith("image/");
    return new Response(new Uint8Array(buf), { headers: { "Content-Type": m.mime, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "sandbox", "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(m.name)}` } });
  }
  if (m.private) {
    // Payment evidence: owning parish, the uploader, or provincial finance/oversight staff only.
    const u = await getUser();
    const staff = u && ["super_admin", "finance_admin", "provincial_admin", "auditor"].includes(u.role);
    const owner = u && (String(m.uploadedBy) === u.id || (u.parish && String(m.parish) === u.parish));
    if (!staff && !owner) throw new ApiError(u ? 403 : 401, "You don't have access to this file.");
    const buf: Buffer = Buffer.isBuffer(m.data) ? m.data : Buffer.from(m.data.buffer);
    return new Response(new Uint8Array(buf), { headers: { "Content-Type": m.mime, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Disposition": "inline" } });
  }
  const bytes: Buffer = Buffer.isBuffer(m.data) ? m.data : Buffer.from(m.data.buffer);
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": m.mime,
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      "X-Content-Type-Options": "nosniff",
    },
  });
});

export const DELETE = handle<Ctx>(async (req, ctx) => {
  const user = await requireApiUser(PERMS.media);
  const { id } = await ctx.params;
  const { Media } = await getDb();
  const m = await Media.findByIdAndDelete(id);
  if (!m) throw new ApiError(404, "Not found");
  await audit(user, "media.delete", m.name, undefined, req);
  return { ok: true };
});
