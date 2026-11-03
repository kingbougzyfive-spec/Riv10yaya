import { z } from "zod";
import { handle, audit } from "@/lib/api";
import { ApiError, createSession, hashPassword } from "@/lib/auth";
import { addConnection, getDb, isDatabaseConfigured, resetConnection, testUri, AllDatabasesFailedError } from "@/lib/db";

export const dynamic = "force-dynamic";

/** First-run status. Public, but reveals only booleans. */
export const GET = handle(async () => {
  if (!isDatabaseConfigured()) return { hasDb: false, hasUsers: false };
  try {
    const { User } = await getDb();
    return { hasDb: true, hasUsers: (await User.estimatedDocumentCount()) > 0 };
  } catch (e) {
    if (e instanceof AllDatabasesFailedError) return { hasDb: true, hasUsers: false, dbError: (e as Error).message };
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
  password: z.string().min(10, "Use at least 10 characters").max(100),
});

export const POST = handle(async (req) => {
  const body = await req.json();

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
    const { User } = await getDb();
    if ((await User.estimatedDocumentCount()) > 0) throw new ApiError(403, "Setup is already complete.");
    const user = await User.create({
      name: input.name,
      email: input.email,
      passwordHash: await hashPassword(input.password),
      role: "super_admin",
    });
    await createSession(String(user._id), "super_admin");
    await audit({ id: String(user._id), name: user.name, email: user.email, role: "super_admin" }, "setup.super_admin_created", user.email, undefined, req);
    return { ok: true };
  }

  throw new ApiError(400, "Unknown action.");
});
