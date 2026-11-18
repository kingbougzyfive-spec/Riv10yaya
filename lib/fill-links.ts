import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { ApiError, sessionKey } from "./auth";
import { getDb } from "./db";
import { MIN } from "./ratelimit";

/** A fill-in link is two things: a secret web address and a password. Both are needed, and the password is only ever stored as a hash. */
export const newToken = () => crypto.randomBytes(32).toString("base64url");

// Letters and numbers that cannot be mistaken for each other (no 0/O, 1/I/L), so a password read out over the phone is typed correctly.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
/** e.g. K7MQ-X4PD : 8 characters from a 31-character alphabet, with only 5 wrong guesses allowed per 15 minutes. */
export function newPassword() {
  const pick = () => ALPHABET[crypto.randomInt(ALPHABET.length)];
  return `${Array.from({ length: 4 }, pick).join("")}-${Array.from({ length: 4 }, pick).join("")}`;
}
export const normalisePassword = (p: string) => p.trim();
export const hashLinkPassword = (p: string) => bcrypt.hash(normalisePassword(p), 10);

export const MAX_FAILS = 5;
export const LOCK_MS = 15 * MIN;
export const SESSION_MS = 3 * 60 * MIN;
export const EXPIRY_DAYS = [1, 3, 7, 14, 30] as const;

export type LinkState = "ok" | "expired" | "revoked" | "locked";
export const stateOf = (l: { expiresAt: Date; revokedAt?: Date | null; lockedUntil?: Date | null }, now = Date.now()): LinkState =>
  l.revokedAt ? "revoked" : +new Date(l.expiresAt) <= now ? "expired" : l.lockedUntil && +new Date(l.lockedUntil) > now ? "locked" : "ok";

export const STATE_MESSAGE: Record<Exclude<LinkState, "ok">, string> = {
  revoked: "This link was cancelled by the person who made it. Please ask them for a new one.",
  expired: "This link has expired. Please ask the person who made it for a new one.",
  locked: "Too many wrong passwords. This link is locked for a little while. Please try again in 15 minutes, or ask for the password again.",
};

/** The link behind a web address, or null. Never reveals why it is missing. */
export async function findLink(token: string) {
  if (!token || token.length < 30 || token.length > 80) return null;
  const { FillLink } = await getDb();
  return FillLink.findOne({ token });
}

/** Checks the password. Wrong guesses are counted on the link itself, so the limit holds no matter which device or address the guesses come from. */
export async function tryPassword(link: any, password: string): Promise<boolean> {
  if (stateOf(link) === "locked") throw new ApiError(429, STATE_MESSAGE.locked);
  const ok = await bcrypt.compare(normalisePassword(password), link.passwordHash);
  if (ok) { link.failedAttempts = 0; link.lockedUntil = undefined; await link.save(); return true; }
  link.failedAttempts = (link.failedAttempts ?? 0) + 1;
  if (link.failedAttempts >= MAX_FAILS) { link.lockedUntil = new Date(Date.now() + LOCK_MS); link.failedAttempts = 0; }
  await link.save();
  return false;
}

const cookieName = (link: any) => `fl_${String(link._id).slice(-12)}`;

/** After the right password: a short, signed, HttpOnly session for this one link, carrying the name the person gave. */
export async function openSession(link: any, who: { name: string; phone: string }) {
  const jwt = await new SignJWT({ lid: String(link._id), pv: link.passwordVersion ?? 0, fn: who.name, fp: who.phone })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor((Date.now() + SESSION_MS) / 1000))
    .sign(await sessionKey());
  (await cookies()).set(cookieName(link), jwt, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: Math.floor(SESSION_MS / 1000) });
}

/** The link for this address, but only if the password was entered in this browser, the link is still valid, and the password has not been reset since. */
export async function requireOpenLink(token: string) {
  const link = await findLink(token);
  if (!link) throw new ApiError(404, "This link isn't valid.");
  const st = stateOf(link);
  if (st !== "ok") throw new ApiError(st === "locked" ? 429 : 410, STATE_MESSAGE[st]);
  const raw = (await cookies()).get(cookieName(link))?.value;
  if (!raw) throw new ApiError(401, "Please enter the password to open this form.");
  try {
    const { payload } = await jwtVerify(raw, await sessionKey());
    if (payload.lid !== String(link._id) || Number(payload.pv ?? 0) !== (link.passwordVersion ?? 0)) throw new Error("stale");
    return { link, who: { name: String(payload.fn ?? ""), phone: String(payload.fp ?? "") } };
  } catch { throw new ApiError(401, "Please enter the password to open this form."); }
}

/** Who is recorded as the submitter: the administrator who made the link, with the name of the person who actually filled it in. */
export function submitterFor(link: any, who: { name: string; phone: string }) {
  const byName = `${who.name} (via link from ${link.createdByName})`;
  return { id: String(link.createdBy), byName, audit: { id: String(link.createdBy), name: byName, email: "", role: undefined } as any };
}

/** The unit a monthly link is for, in the same shape the signed-in forms use. */
export async function identityOfLink(link: any) {
  const { Zone, Area, Parish } = await getDb();
  const [z, a, p] = await Promise.all([
    link.zone ? Zone.findById(link.zone, { name: 1 }).lean<any>() : null,
    link.area ? Area.findById(link.area, { name: 1 }).lean<any>() : null,
    link.parish ? Parish.findById(link.parish, { name: 1 }).lean<any>() : null,
  ]);
  return {
    type: link.unitType as "parish" | "area" | "zone",
    zone: String(link.zone), area: link.area ? String(link.area) : null, parish: link.parish ? String(link.parish) : null,
    names: { zone: z?.name, area: a?.name ?? null, parish: p?.name ?? null },
  };
}
