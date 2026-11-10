import { ApiError } from "./auth";
import { getDb } from "./db";

/** Fixed-window counters kept in the database, so limits hold across serverless instances (an in-memory
 *  counter would reset on every cold start). Keys are hashed-looking strings made by the caller. */
export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}

async function bump(key: string, windowMs: number): Promise<number> {
  const { RateLimit } = await getDb();
  const slot = Math.floor(Date.now() / windowMs);
  const doc = await RateLimit.findOneAndUpdate(
    { key: `${key}:${slot}` },
    { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date((slot + 2) * windowMs) } },
    { upsert: true, new: true },
  ).lean<any>();
  return doc?.count ?? 1;
}
async function peek(key: string, windowMs: number): Promise<number> {
  const { RateLimit } = await getDb();
  const slot = Math.floor(Date.now() / windowMs);
  return (await RateLimit.findOne({ key: `${key}:${slot}` }).lean<any>())?.count ?? 0;
}

/** Counts this call and throws 429 once `max` is passed inside the window. */
export async function rateLimit(key: string, max: number, windowMs: number, message = "Too many requests. Please wait a little and try again.") {
  let n: number;
  try { n = await bump(key, windowMs); } catch { return; } // a counter outage must not take the site down
  if (n > max) throw new ApiError(429, message);
}

/** For failed-login style limits: check first, then call `rateFail` only when the attempt failed. */
export async function rateBlocked(key: string, max: number, windowMs: number): Promise<boolean> {
  try { return (await peek(key, windowMs)) >= max; } catch { return false; }
}
export async function rateFail(key: string, windowMs: number) {
  try { await bump(key, windowMs); } catch {}
}
export async function rateClear(key: string, windowMs: number) {
  try { const { RateLimit } = await getDb(); await RateLimit.deleteOne({ key: `${key}:${Math.floor(Date.now() / windowMs)}` }); } catch {}
}

export const MIN = 60_000;
export const HOUR = 60 * MIN;
