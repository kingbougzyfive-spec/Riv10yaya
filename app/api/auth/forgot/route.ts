import crypto from "node:crypto";
import { z } from "zod";
import { handle } from "@/lib/api";
import { ApiError } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { appUrl, throttle } from "@/lib/ids";
import { mailConfigured, sendMail } from "@/lib/mail";

export const dynamic = "force-dynamic";

/** Always answers the same way whether or not the email exists, so it can't be used to discover accounts. */
export const POST = handle(async (req) => {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!throttle(`forgot:${ip}`, 5, 10 * 60_000)) throw new ApiError(429, "Too many requests. Please try again in a few minutes.");
  const { email } = z.object({ email: z.string().email() }).parse(await req.json());
  if (!mailConfigured()) return { ok: true, emailConfigured: false };
  const { User, PasswordReset } = await getDb();
  const u = await User.findOne({ email: email.toLowerCase(), active: true });
  if (u) {
    const token = crypto.randomBytes(32).toString("base64url");
    await PasswordReset.deleteMany({ user: u._id });
    await PasswordReset.create({ user: u._id, tokenHash: crypto.createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + 60 * 60_000) });
    const link = `${appUrl()}/reset?token=${token}`;
    await sendMail({ to: u.email, subject: "Reset your password", html: `<p>Hello ${u.name},</p><p>Use this link to choose a new password. It works once and expires in 1 hour.</p><p><a href="${link}">${link}</a></p><p>If you didn't ask for this, ignore this email.</p>` }).catch(() => {});
  }
  return { ok: true, emailConfigured: true };
});
