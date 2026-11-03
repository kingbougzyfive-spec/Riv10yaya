import crypto from "node:crypto";

/** Unambiguous alphabet (no 0/O/1/I) for human-readable references. */
const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function code(len: number): string {
  const b = crypto.randomBytes(len);
  return Array.from(b, (x: number) => ALPHA[x % ALPHA.length]).join("");
}
export const newToken = () => crypto.randomBytes(18).toString("base64url"); // session tokens / QR payloads
export const newRegId = () => crypto.randomUUID();
export const registrationRef = () => `YAYA-${code(3)}-${code(4)}`;
export const memberId = () => `YM-${code(6)}`;

/** Canonical phone key so 0803…, +234803… and 234803… are the same person. */
export function phoneKey(raw: string): string {
  const d = raw.replace(/[^\d+]/g, "");
  if (/^\+?234[789][01]\d{8}$/.test(d)) return d.replace(/^\+?234/, "0");
  return d.replace(/^\+/, "");
}
export const validPhone = (raw: string) => /^(?:(?:\+?234|0)[789][01]\d{8}|\+\d{8,15})$/.test(raw.replace(/[\s()-]/g, ""));

export const appUrl = () => (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");

/** Simple per-IP throttle for public endpoints (per server instance). */
const hits = new Map<string, number[]>();
export function throttle(key: string, max = 20, windowMs = 60_000): boolean {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(key, arr);
  return arr.length <= max;
}

export function distanceM(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000, rad = (d: number) => (d * Math.PI) / 180;
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
