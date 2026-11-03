import { z } from "zod";
import { handle, audit } from "@/lib/api";
import { ApiError, hashPassword, requireApiUser, verifyPassword } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export const POST = handle(async (req) => {
  const user = await requireApiUser();
  const i = z.object({ current: z.string().min(1).max(100), next: z.string().min(10, "Use at least 10 characters").max(100) }).parse(await req.json());
  const { User } = await getDb();
  const u = await User.findById(user.id);
  if (!u || !(await verifyPassword(i.current, u.passwordHash))) throw new ApiError(400, "Your current password isn't correct.");
  u.passwordHash = await hashPassword(i.next);
  await u.save();
  await audit(user, "auth.password_change", user.email, undefined, req);
  return { ok: true };
});
