import { handle, audit } from "@/lib/api";
import { destroySession, getUser } from "@/lib/auth";

export const POST = handle(async (req) => {
  const u = await getUser().catch(() => null);
  await destroySession();
  if (u) await audit(u, "auth.logout", u.email, undefined, req);
  return { ok: true };
});
