import crypto from "node:crypto";
import { z } from "zod";
import { handle, audit } from "@/lib/api";
import { ApiError, hashPassword } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { throttle } from "@/lib/ids";

export const dynamic = "force-dynamic";

export const POST = handle(async (req) => {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!throttle(`reset:${ip}`, 10, 10 * 60_000)) throw new ApiError(429, "Too many attempts. Please wait a few minutes.");
  const { token, password } = z.object({ token: z.string().min(20).max(100), password: z.string().min(10, "Use at least 10 characters").max(100) }).parse(await req.json());
  const { User, PasswordReset } = await getDb();
  const row = await PasswordReset.findOneAndDelete({ tokenHash: crypto.createHash("sha256").update(token).digest("hex"), expiresAt: { $gt: new Date() } });
  if (!row) throw new ApiError(400, "This reset link is invalid or has expired. Request a new one.");
  const u = await User.findById(row.user);
  if (!u || !u.active) throw new ApiError(400, "This account can't be reset.");
  u.passwordHash = await hashPassword(password);
  await u.save();
  await PasswordReset.deleteMany({ user: u._id });
  await audit({ id: String(u._id), name: u.name, email: u.email, role: u.role }, "auth.password_reset", u.email, undefined, req);
  return { ok: true };
});
