import { z } from "zod";
import { handle, audit } from "@/lib/api";
import { ApiError, createSession, verifyPassword } from "@/lib/auth";
import { getDb } from "@/lib/db";

const schema = z.object({ email: z.string().email(), password: z.string().min(1).max(100) });

// Small in-memory throttle: 8 failed attempts per email+IP per 10 minutes.
const fails = new Map<string, { n: number; until: number }>();

export const POST = handle(async (req) => {
  const { email, password } = schema.parse(await req.json());
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const k = `${email.toLowerCase()}|${ip}`;
  const f = fails.get(k);
  if (f && f.n >= 8 && f.until > Date.now()) throw new ApiError(429, "Too many attempts. Please wait a few minutes and try again.");

  const { User } = await getDb();
  const user = await User.findOne({ email: email.toLowerCase() });
  const ok = !!user && user.active && (await verifyPassword(password, user.passwordHash));
  if (!ok || !user) {
    fails.set(k, { n: (f?.n ?? 0) + 1, until: Date.now() + 10 * 60_000 });
    throw new ApiError(401, "Incorrect email or password.");
  }
  fails.delete(k);
  user.lastLoginAt = new Date();
  await user.save();
  await createSession(String(user._id), user.role);
  await audit({ id: String(user._id), name: user.name, email: user.email, role: user.role }, "auth.login", user.email, undefined, req);
  return { ok: true, role: user.role };
});
