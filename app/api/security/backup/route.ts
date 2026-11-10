import { gzipSync } from "node:zlib";
import { handle, audit } from "@/lib/api";
import { ApiError, requireApiUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { SYNC_COLLECTIONS } from "@/lib/models";
import { HOUR, rateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Never exported: credentials, reset tokens, push keys, and anything encrypted. Image/file bytes are left out (their hashes stay).
const SKIP = new Set(["PasswordReset", "PushSub"]);
const SECRET = /^(passwordHash|tokenHash|sessionVersion|encryptedUri|uri|secret|apiKey|data|keys|p256dh|auth)$/i;
const strip = (v: any): any => {
  if (Array.isArray(v)) return v.map(strip);
  if (v && typeof v === "object" && !(v instanceof Date) && !v._bsontype) { const o: any = {}; for (const [k, x] of Object.entries(v)) if (!SECRET.test(k)) o[k] = strip(x); return o; }
  return v?._bsontype ? String(v) : v;
};
const LIMIT_BYTES = 4_000_000; // hosting platforms cap a normal response near 4.5 MB

/** A convenience copy of the data as gzip-compressed JSON Lines, for small installs and for a manual safety copy.
 *  It is NOT a substitute for database backups (Atlas), which also cover files and point-in-time recovery. */
export const GET = handle(async (req) => {
  const user = await requireApiUser(["super_admin"]);
  await rateLimit(`backup:${user.id}`, 3, HOUR, "Too many backup downloads this hour.");
  const db = await getDb();
  const lines: string[] = [JSON.stringify({ _meta: { app: "rccg-rivers10-yaya", at: new Date().toISOString(), note: "Passwords, tokens and file bytes are excluded." } })];
  const counts: Record<string, number> = {};
  let size = 0;
  for (const name of SYNC_COLLECTIONS) {
    if (SKIP.has(name)) continue;
    let n = 0;
    for await (const doc of (db as any)[name].find().lean().cursor()) {
      const line = JSON.stringify({ c: name, d: strip(doc) });
      size += line.length;
      if (size > 60_000_000) throw new ApiError(413, "This database is too large to download here. Use your Atlas backups or Admin, Database, Sync instead.");
      lines.push(line); n++;
    }
    counts[name] = n;
  }
  const gz = gzipSync(Buffer.from(lines.join("\n")));
  if (gz.length > LIMIT_BYTES) throw new ApiError(413, "The backup is larger than can be downloaded here. Use your Atlas backups or Admin, Database, Sync instead.");
  await audit(user, "backup.download", "json backup", { entity: "backup", after: { collections: counts, bytes: gz.length } }, req);
  return new Response(new Uint8Array(gz), { headers: { "Content-Type": "application/gzip", "Content-Disposition": `attachment; filename="rivers10-yaya-backup-${new Date().toISOString().slice(0, 10)}.jsonl.gz"`, "Cache-Control": "no-store" } });
});
