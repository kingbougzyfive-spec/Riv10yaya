import crypto from "node:crypto";
import { z } from "zod";
import { handle, audit } from "@/lib/api";
import { ApiError, hashPassword } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { passwordProblem } from "@/lib/password";
import { MIN, clientIp, rateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

export const POST = handle(async (req) => {
  await rateLimit(`reset:${clientIp(req)}`, 10, 10 * MIN, "Too many attempts. Please wait a few minutes.");
  const { token, password } = z.object({ token: z.string().min(20).max(100), password: z.string().min(1).max(100) }).parse(await req.json());
  const { User, PasswordReset } = await getDb();
  const row = await PasswordReset.findOneAndDelete({ tokenHash: crypto.createHash("sha256").update(token).digest("hex"), expiresAt: { $gt: new Date() } });
  if (!row) throw new ApiError(400, "This reset link is invalid or has expired. Request a new one.");
  const u = await User.findById(row.user);
  if (!u || !u.active) throw new ApiError(400, "This account can't be reset.");
  const problem = passwordProblem(password, { email: u.email, name: u.name });
  if (problem) throw new ApiError(422, problem);
  u.passwordHash = await hashPassword(password);
  u.mustChangePassword = false;
  u.passwordChangedAt = new Date();
  u.sessionVersion = (u.sessionVersion ?? 0) + 1;
  await u.save();
  await PasswordReset.deleteMany({ user: u._id });
  await audit({ id: String(u._id), name: u.name, email: u.email, role: u.role }, "auth.password_reset", u.email, { entity: "user", entityId: String(u._id) }, req);
  return { ok: true };
});
