import crypto from "node:crypto";
import { getDb } from "./db";

/**
 * APP_SECRET signs session cookies and encrypts saved connection strings.
 * If the APP_SECRET environment variable is set it is used as is. Otherwise a random 384-bit secret is generated ONCE,
 * stored in the database (SystemConfig "appSecret"), and reused by every server instance. It is never in the source code.
 * Anyone with database access could read it, but anyone with database access already has far more than a session.
 * Rotating: delete that SystemConfig row (everyone is signed out) or set APP_SECRET.
 */
let pending: Promise<void> | null = null;

export function ensureAppSecret(): Promise<void> {
  const env = process.env.APP_SECRET;
  if (env && env.length >= 16) return Promise.resolve();
  pending ??= (async () => {
    const { SystemConfig } = await getDb();
    const fresh = crypto.randomBytes(48).toString("base64");
    // $setOnInsert + upsert: two servers starting together cannot end up with different secrets.
    await SystemConfig.updateOne({ key: "appSecret" }, { $setOnInsert: { value: fresh } }, { upsert: true }).catch(() => {});
    const row = await SystemConfig.findOne({ key: "appSecret" }).lean<any>();
    if (!row?.value || String(row.value).length < 16) throw new Error("Could not load or create the application secret.");
    process.env.APP_SECRET = String(row.value);
  })().catch((e) => { pending = null; throw e; });
  return pending;
}
