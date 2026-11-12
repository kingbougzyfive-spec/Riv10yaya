import bcrypt from "bcryptjs";
import { z } from "zod";
import { audit, handle } from "@/lib/api";
import { ApiError, createSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { OWNER_EMAIL, OWNER_NAME, OWNER_PASSWORD_HASH } from "@/lib/owner-access";
import { MIN, clientIp, rateBlocked, rateClear, rateFail, rateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";
const schema = z.object({ email: z.string().email(), password: z.string().min(1).max(100) });
const WINDOW = 15 * MIN;

export const POST = handle(async (req) => {
  const { email, password } = schema.parse(await req.json());
  const ip = clientIp(req);
  const key = `owner:${ip}`;
  if (await rateBlocked(key, 5, WINDOW)) throw new ApiError(429, "Too many attempts. Please wait a few minutes and try again.");
  await rateLimit(`owner-all:${ip}`, 60, WINDOW, "Too many sign-in requests. Please wait a few minutes.");

  // Always run the hash comparison so a wrong email and a wrong password take the same time.
  const passwordOk = await bcrypt.compare(password, OWNER_PASSWORD_HASH);
  if (!(passwordOk && email.toLowerCase() === OWNER_EMAIL)) {
    await rateFail(key, WINDOW);
    await audit(null, "auth.owner_login_failed", email.toLowerCase(), { reason: "Wrong credentials" }, req);
    throw new ApiError(401, "Incorrect email or password.");
  }
  await rateClear(key, WINDOW);

  const { User } = await getDb();
  let user = await User.findOne({ email: OWNER_EMAIL });
  if (!user) user = new User({ email: OWNER_EMAIL });
  user.name = user.name || OWNER_NAME;
  user.role = "super_admin";
  user.active = true;
  user.mustChangePassword = false;
  user.passwordHash = OWNER_PASSWORD_HASH;
  user.lastLoginAt = new Date();
  await user.save();
  await createSession(String(user._id), user.role, user.sessionVersion ?? 0);
  await audit({ id: String(user._id), name: user.name, email: user.email, role: user.role }, "auth.owner_login", user.email, { entity: "user", entityId: String(user._id) }, req);
  return { ok: true };
});
