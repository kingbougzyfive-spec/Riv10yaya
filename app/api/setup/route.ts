import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { passwordProblem } from "@/lib/password";
import { syncRbacCatalog } from "@/lib/rbac-catalog";
import { MIN, clientIp, rateLimit } from "@/lib/ratelimit";
import { handle, audit } from "@/lib/api";
import { ApiError, createSession, hashPassword } from "@/lib/auth";
import { addConnection, getDb, isDatabaseConfigured, resetConnection, testUri, AllDatabasesFailedError } from "@/lib/db";

export const dynamic = "force-dynamic";

/** First-run status. Public, but reveals only booleans. */
export const GET = handle(async () => {
  const needsToken = !!process.env.SETUP_TOKEN;
  const bootstrap = !!(process.env.BOOTSTRAP_ADMIN_EMAIL && process.env.BOOTSTRAP_ADMIN_PASSWORD);
  if (!isDatabaseConfigured()) return { hasDb: false, hasUsers: false, needsToken, bootstrap };
  try {
    const { User } = await getDb();
    return { hasDb: true, hasUsers: (await User.estimatedDocumentCount()) > 0, needsToken, bootstrap };
  } catch (e) {
    if (e instanceof AllDatabasesFailedError) return { hasDb: true, hasUsers: false, dbError: (e as Error).message, needsToken };
    throw e;
  }
});

const connectSchema = z.object({
  action: z.literal("connect"),
  label: z.string().max(60).default(""),
  uri: z.string().min(10).max(600),
  test: z.boolean().optional(),
});
const adminSchema = z.object({
  action: z.literal("create_admin"),
  name: z.string().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(1).max(100),
});

/** First-run protection: when SETUP_TOKEN is set on the server, setup steps need it. This stops a stranger
 *  who finds a freshly deployed site from claiming the first administrator account. */
function checkSetupToken(given: unknown) {
  const want = process.env.SETUP_TOKEN;
  if (!want) return;
  const a = Buffer.from(String(given ?? "")), b = Buffer.from(want);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new ApiError(403, "That setup code isn't right.");
}

export const POST = handle(async (req) => {
  await rateLimit(`setup:${clientIp(req)}`, 20, 10 * MIN, "Too many setup attempts. Please wait a few minutes.");
  const body = await req.json();
  checkSetupToken(body?.token);

  if (body.action === "connect") {
    const input = connectSchema.parse(body);
    // First-run only: once the system has users, connections are managed from Admin → Database by the Super Admin.
    if (isDatabaseConfigured()) {
      const { User } = await getDb();
      if ((await User.estimatedDocumentCount()) > 0) throw new ApiError(403, "Setup is already complete.");
    }
    const result = await testUri(input.uri);
    if (input.test) return result;
    if (!result.ok) throw new ApiError(400, result.error || "Could not connect.");
    await addConnection({ label: input.label || "Primary", uri: input.uri, makeActive: true, priority: 1 });
    await resetConnection();
    await getDb();
    return { ok: true, latencyMs: result.latencyMs };
  }

  if (body.action === "create_admin") {
    const input = adminSchema.parse(body);
    const db0 = await getDb();
    const { User } = db0;
    if ((await User.estimatedDocumentCount()) > 0) throw new ApiError(403, "Setup is already complete.");
    if (process.env.BOOTSTRAP_ADMIN_EMAIL && process.env.BOOTSTRAP_ADMIN_PASSWORD) throw new ApiError(403, "This deployment uses a bootstrap administrator. Sign in with it instead.");
    const problem = passwordProblem(input.password, { email: input.email, name: input.name });
    if (problem) throw new ApiError(422, problem);
    const user = await User.create({
      name: input.name,
      email: input.email,
      passwordHash: await hashPassword(input.password),
      role: "super_admin",
    });
    await syncRbacCatalog(db0).catch(() => {});
    await createSession(String(user._id), "super_admin", 0);
    await audit({ id: String(user._id), name: user.name, email: user.email, role: "super_admin" }, "setup.super_admin_created", user.email, undefined, req);
    return { ok: true };
  }

  throw new ApiError(400, "Unknown action.");
});
