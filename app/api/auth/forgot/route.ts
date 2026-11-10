import crypto from "node:crypto";
import { z } from "zod";
import { handle, audit } from "@/lib/api";
import { ApiError } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { appUrl } from "@/lib/ids";
import { MIN, clientIp, rateLimit } from "@/lib/ratelimit";
import { mailConfigured, sendMail } from "@/lib/mail";

export const dynamic = "force-dynamic";

/** Always answers the same way whether or not the email exists, so it can't be used to discover accounts. */
export const POST = handle(async (req) => {
  await rateLimit(`forgot:${clientIp(req)}`, 5, 10 * MIN, "Too many requests. Please try again in a few minutes.");
  const { email } = z.object({ email: z.string().email() }).parse(await req.json());
  if (!mailConfigured()) return { ok: true, emailConfigured: false };
  const { User, PasswordReset } = await getDb();
  const u = await User.findOne({ email: email.toLowerCase(), active: true });
  if (u) {
    const token = crypto.randomBytes(32).toString("base64url");
    await PasswordReset.deleteMany({ user: u._id });
    await PasswordReset.create({ user: u._id, tokenHash: crypto.createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + 60 * 60_000) });
    await audit({ id: String(u._id), name: u.name, email: u.email, role: u.role }, "auth.password_reset_requested", u.email, { entity: "user", entityId: String(u._id) }, req);
    const link = `${appUrl()}/reset?token=${token}`;
    await sendMail({ to: u.email, subject: "Reset your password", html: `<p>Hello ${u.name},</p><p>Use this link to choose a new password. It works once and expires in 1 hour.</p><p><a href="${link}">${link}</a></p><p>If you didn't ask for this, ignore this email.</p>` }).catch(() => {});
  }
  return { ok: true, emailConfigured: true };
});
