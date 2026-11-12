import { ensureAppSecret } from "./secret";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { getDb } from "./db";
import type { Role } from "./roles";

const COOKIE = "yaya_session";
const MAX_AGE = 60 * 60 * 12; // 12 hours

async function ensureSecret() { await ensureAppSecret(); return secret(); }
function secret() {
  const s = process.env.APP_SECRET;
  if (!s || s.length < 16) throw new ApiError(500, "APP_SECRET is not configured. It is normally created automatically in the database.");
  return new TextEncoder().encode(s);
}

import { ApiError } from "./errors";
export { ApiError };

export const hashPassword = (p: string) => bcrypt.hash(p, 11);
export const verifyPassword = (p: string, h: string) => bcrypt.compare(p, h);

/** `sv` is the person's sessionVersion; bumping it in the database signs every older session out. */
export async function createSession(userId: string, role: Role, sv = 0) {
  const token = await new SignJWT({ uid: userId, role, sv })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(await ensureSecret());
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: Role;
  zone?: string;
  area?: string;
  parish?: string;
  /** Using a temporary password: only the change-password screen is allowed until it is replaced. */
  mustChange?: boolean;
};

/** Signs the person out everywhere (all existing sessions stop working at their next request). */
export async function revokeSessions(userId: string) {
  const { User } = await getDb();
  await User.updateOne({ _id: userId }, { $inc: { sessionVersion: 1 } });
}

/** Resolves the signed-in user from the cookie and re-checks the database (role changes apply immediately). */
export async function getUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  // Database trouble (a brief Atlas/Vercel blip) must NEVER look like "signed out": those errors propagate so the page
  // shows a "reconnecting" screen and the session stays valid. Only a bad, forged or expired token means signed out.
  const key = await ensureSecret();
  let payload: any;
  try { ({ payload } = await jwtVerify(token, key)); } catch { return null; }
  const { User } = await getDb();
  let u: any;
  try { u = await User.findById(payload.uid).lean<any>(); }
  catch (e: any) { if (/not reach any configured database/i.test(String(e?.message))) throw e; await new Promise((r) => setTimeout(r, 400)); u = await User.findById(payload.uid).lean<any>(); }
  {
    if (!u || !u.active) return null;
    if (Number(payload.sv ?? 0) !== Number(u.sessionVersion ?? 0)) return null;
    return {
      id: String(u._id),
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role,
      zone: u.zone ? String(u.zone) : undefined,
      area: u.area ? String(u.area) : undefined,
      parish: u.parish ? String(u.parish) : undefined,
      mustChange: !!u.mustChangePassword,
    };
  }
}

/** For route handlers: throws 401/403 JSON errors. Authorization is enforced here, on the server. */
export async function requireApiUser(roles?: readonly Role[], opts?: { allowMustChange?: boolean }): Promise<SessionUser> {
  const user = await getUser();
  if (!user) throw new ApiError(401, "Please sign in.");
  if (user.mustChange && !opts?.allowMustChange) throw new ApiError(403, "Please choose a new password first (Account page).");
  if (roles && !roles.includes(user.role)) throw new ApiError(403, "You don't have permission to do that.");
  return user;
}

/** For server components: redirects instead of throwing. */
export async function requirePageUser(roles?: readonly Role[]): Promise<SessionUser> {
  const user = await getUser();
  if (!user) redirect("/login");
  if (user.mustChange) {
    const target = user.role === "member" ? "/member" : "/admin/account";
    const here = (await headers()).get("x-path") || "";
    if (here !== target) redirect(`${target}?force=1`);
  }
  if (roles && !roles.includes(user.role)) {
    // Send people somewhere they ARE allowed. Redirecting a member to /admin?denied=1 looped forever, because /admin refuses them too.
    redirect(user.role === "member" ? "/member" : user.role === "parish_admin" ? "/portal" : "/admin?denied=1");
  }
  return user;
}
