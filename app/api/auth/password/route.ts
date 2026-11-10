import { z } from "zod";
import { handle, audit } from "@/lib/api";
import { ApiError, createSession, hashPassword, requireApiUser, verifyPassword } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { passwordProblem } from "@/lib/password";
import { HOUR, rateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

export const POST = handle(async (req) => {
  const user = await requireApiUser(undefined, { allowMustChange: true });
  await rateLimit(`pw:${user.id}`, 10, HOUR, "Too many password attempts. Please try again later.");
  const i = z.object({ current: z.string().min(1).max(100), next: z.string().min(1).max(100) }).parse(await req.json());
  const { User } = await getDb();
  const u = await User.findById(user.id);
  if (!u || !(await verifyPassword(i.current, u.passwordHash))) throw new ApiError(400, "Your current password isn't correct.");
  const problem = passwordProblem(i.next, { email: u.email, name: u.name });
  if (problem) throw new ApiError(422, problem);
  if (await verifyPassword(i.next, u.passwordHash)) throw new ApiError(422, "Choose a password you haven't been using.");
  const wasTemporary = !!u.mustChangePassword;
  u.passwordHash = await hashPassword(i.next);
  u.mustChangePassword = false;
  u.passwordChangedAt = new Date();
  u.sessionVersion = (u.sessionVersion ?? 0) + 1; // every other device is signed out
  await u.save();
  await createSession(String(u._id), u.role, u.sessionVersion); // keep this device signed in
  await audit(user, "auth.password_change", user.email, { entity: "user", entityId: user.id, after: { temporaryReplaced: wasTemporary, otherSessionsEnded: true } }, req);
  return { ok: true };
});
