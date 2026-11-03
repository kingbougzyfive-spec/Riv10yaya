import crypto from "node:crypto";

function key(): Buffer {
  const secret = process.env.APP_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("APP_SECRET is missing or too short. Set it in .env.local (see .env.example).");
  }
  return crypto.createHash("sha256").update(secret).digest();
}

/** AES-256-GCM. Output: base64(iv).base64(tag).base64(data) */
export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, data].map((b) => b.toString("base64")).join(".");
}

export function decrypt(payload: string): string {
  const [iv, tag, data] = payload.split(".").map((p) => Buffer.from(p, "base64"));
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

/** Hide credentials in a Mongo URI for display. */
export function maskUri(uri: string): string {
  try {
    return uri.replace(/\/\/([^:@/]+):([^@]+)@/, (_m, u) => `//${u}:••••••@`);
  } catch {
    return "••••";
  }
}

/** Short host label, e.g. cluster0.abcde.mongodb.net */
export function uriHost(uri: string): string {
  const m = uri.match(/@([^/?]+)/) || uri.match(/\/\/([^/?]+)/);
  return m ? m[1] : "unknown";
}
