import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { getDb } from "./db";
import type { Role } from "./roles";

const COOKIE = "yaya_session";
const MAX_AGE = 60 * 60 * 12; // 12 hours

function secret() {
  const s = process.env.APP_SECRET;
  if (!s || s.length < 16) throw new ApiError(500, "APP_SECRET is not configured. Add it to .env.local (see .env.example).");
  return new TextEncoder().encode(s);
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const hashPassword = (p: string) => bcrypt.hash(p, 11);
export const verifyPassword = (p: string, h: string) => bcrypt.compare(p, h);

export async function createSession(userId: string, role: Role) {
  const token = await new SignJWT({ uid: userId, role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
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
};

/** Resolves the signed-in user from the cookie and re-checks the database (role changes apply immediately). */
export async function getUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const { User } = await getDb();
    const u = await User.findById(payload.uid).lean<any>();
    if (!u || !u.active) return null;
    return {
      id: String(u._id),
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role,
      zone: u.zone ? String(u.zone) : undefined,
      area: u.area ? String(u.area) : undefined,
      parish: u.parish ? String(u.parish) : undefined,
    };
  } catch {
    return null;
  }
}

/** For route handlers: throws 401/403 JSON errors. Authorization is enforced here, on the server. */
export async function requireApiUser(roles?: readonly Role[]): Promise<SessionUser> {
  const user = await getUser();
  if (!user) throw new ApiError(401, "Please sign in.");
  if (roles && !roles.includes(user.role)) throw new ApiError(403, "You don't have permission to do that.");
  return user;
}

/** For server components: redirects instead of throwing. */
export async function requirePageUser(roles?: readonly Role[]): Promise<SessionUser> {
  const user = await getUser();
  if (!user) redirect("/login");
  if (roles && !roles.includes(user.role)) redirect("/admin?denied=1");
  return user;
}
