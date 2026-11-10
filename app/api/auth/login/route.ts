import { z } from "zod";
import { handle, audit } from "@/lib/api";
import { ApiError, createSession, hashPassword, verifyPassword } from "@/lib/auth";
import { ensureBootstrapAdmin } from "@/lib/bootstrap";
import { getDb } from "@/lib/db";
import { MIN, clientIp, rateBlocked, rateClear, rateFail, rateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";
const schema = z.object({ email: z.string().email(), password: z.string().min(1).max(100) });
// Compared against when the email is unknown, so a wrong email and a wrong password take the same time.
let dummy: Promise<string> | null = null;
const DUMMY = () => (dummy ??= hashPassword("not-a-real-password-for-timing"));
const WINDOW = 10 * MIN;

export const POST = handle(async (req) => {
  const { email, password } = schema.parse(await req.json());
  const ip = clientIp(req);
  const lower = email.toLowerCase();
  const kAcct = `login:${lower}|${ip}`;
  const kIp = `login-ip:${ip}`;
  // 8 failures per email+address and 30 per address, per 10 minutes. Counted in the database so it holds on serverless.
  if ((await rateBlocked(kAcct, 8, WINDOW)) || (await rateBlocked(kIp, 30, WINDOW))) {
    await audit(null, "auth.login_blocked", lower, { reason: "Too many failed attempts" }, req);
    throw new ApiError(429, "Too many attempts. Please wait a few minutes and try again.");
  }
  await rateLimit(`login-all:${ip}`, 120, WINDOW, "Too many sign-in requests. Please wait a few minutes.");

  await ensureBootstrapAdmin();
  const { User } = await getDb();
  const user = await User.findOne({ email: lower });
  const valid = await verifyPassword(password, user?.passwordHash || (await DUMMY()));
  const ok = !!user && user.active && valid;
  if (!ok || !user) {
    await Promise.all([rateFail(kAcct, WINDOW), rateFail(kIp, WINDOW)]);
    await audit(user ? { id: String(user._id), name: user.name, email: user.email, role: user.role } : null, "auth.login_failed", lower, { reason: !user ? "Unknown email" : !user.active ? "Account deactivated" : "Wrong password" }, req);
    throw new ApiError(401, "Incorrect email or password.");
  }
  await rateClear(kAcct, WINDOW);
  user.lastLoginAt = new Date();
  await user.save();
  await createSession(String(user._id), user.role, user.sessionVersion ?? 0);
  await audit({ id: String(user._id), name: user.name, email: user.email, role: user.role }, "auth.login", user.email, { entity: "user", entityId: String(user._id) }, req);
  return { ok: true, role: user.role, mustChange: !!user.mustChangePassword };
});
