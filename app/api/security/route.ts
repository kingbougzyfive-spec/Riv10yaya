import { handle } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { getDb, listConnections } from "@/lib/db";
import { runChecks } from "@/lib/security-checks";

export const dynamic = "force-dynamic";

/** Super Administrator only: deployment checklist and recent server errors. Never returns a secret value. */
export const GET = handle(async () => {
  await requireApiUser(["super_admin"]);
  const { User, Audit, ErrorLog } = await getDb();
  const since = new Date(Date.now() - 24 * 3600_000);
  const [superAdmins, bootstrapPending, tempPasswords, failed, blocked, errors24h, errors] = await Promise.all([
    User.countDocuments({ role: "super_admin", active: true }),
    User.countDocuments({ bootstrap: true, mustChangePassword: true }),
    User.countDocuments({ mustChangePassword: true, active: true }),
    Audit.countDocuments({ action: "auth.login_failed", createdAt: { $gte: since } }),
    Audit.countDocuments({ action: "auth.login_blocked", createdAt: { $gte: since } }),
    ErrorLog.countDocuments({ createdAt: { $gte: since } }),
    ErrorLog.find().sort({ createdAt: -1 }).limit(30).lean<any[]>(),
  ]);
  let backupConnections = 0;
  try { backupConnections = listConnections().filter((c: any) => !c.active).length; } catch {}
  const checks = runChecks({ env: process.env, superAdmins, bootstrapPending, tempPasswords, backupConnections, failedLogins24h: failed, blockedLogins24h: blocked, errors24h, isProd: process.env.NODE_ENV === "production" });
  return {
    checks,
    errors: errors.map((e) => ({ id: String(e._id), requestId: e.requestId, at: e.createdAt, method: e.method, path: e.path, message: e.message, stack: e.stack })),
  };
});
