import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ApiError } from "./auth";
import { AllDatabasesFailedError, NoDatabaseError, getDb } from "./db";
import type { SessionUser } from "./auth";
import { clientIp, MIN, rateLimit } from "./ratelimit";
import { redact } from "./redact";

type Handler<C> = (req: Request, ctx: C) => Promise<Response | object>;

/** Wraps a route handler: consistent JSON errors for validation, auth and database problems. */
export function handle<C = unknown>(fn: Handler<C>) {
  return async (req: Request, ctx: C) => {
    const requestId = globalThis.crypto.randomUUID().slice(0, 8);
    try {
      // Blanket brake on writes from one address; sensitive routes add tighter limits of their own.
      if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) await rateLimit(`w:${clientIp(req)}`, 150, MIN, "Too many requests. Please slow down for a minute.");
      const out = await fn(req, ctx);
      return out instanceof Response ? out : NextResponse.json(out);
    } catch (e: any) {
      if (e instanceof ApiError) return NextResponse.json({ error: e.message }, { status: e.status });
      if (e instanceof ZodError) {
        const first = e.issues[0];
        const field = first.path.join(".") || "input";
        return NextResponse.json({ error: `${field}: ${first.message}`, issues: e.issues }, { status: 422 });
      }
      if (e instanceof NoDatabaseError) return NextResponse.json({ error: e.message, code: "NO_DB" }, { status: 503 });
      if (e instanceof AllDatabasesFailedError) return NextResponse.json({ error: e.message, code: "DB_DOWN" }, { status: 503 });
      if (e?.code === 11000) return NextResponse.json({ error: "A record with those details already exists." }, { status: 409 });
      console.error(`[${requestId}]`, e);
      await logError(e, req, requestId);
      return NextResponse.json({ error: `Something went wrong. Please try again. (ref ${requestId})`, requestId }, { status: 500 });
    }
  };
}

export { redact };
export type Actor = Pick<SessionUser, "id" | "name"> & Partial<Pick<SessionUser, "email" | "role">>;
export type AuditChange = { entity?: string; entityId?: string; before?: unknown; after?: unknown; reason?: string };

/** Writes one append-only audit row. It never throws: auditing must not break the action itself.
 *  Every row records who (id, name, email, role), what, which record, before/after where relevant, when
 *  (createdAt), the reason when one was required, and where from (ip, device). `detail` may carry
 *  before/after/reason/entity/entityId and they are lifted to their own fields. */
export async function audit(actor: Actor | null, action: string, target?: string, detail?: unknown, req?: Request) {
  try {
    const { Audit } = await getDb();
    let d: any = detail;
    const lifted: AuditChange = {};
    if (d && typeof d === "object" && !Array.isArray(d)) {
      d = { ...d };
      for (const k of ["entity", "entityId", "before", "after", "reason"] as const) if (k in d) { (lifted as any)[k] = d[k]; delete d[k]; }
      if (Object.keys(d).length === 0) d = undefined;
    }
    await Audit.create({
      actor: actor?.id || undefined,
      actorName: actor?.name,
      actorEmail: actor?.email,
      actorRole: actor?.role,
      action,
      target,
      entity: lifted.entity,
      entityId: lifted.entityId,
      before: lifted.before === undefined ? undefined : redact(lifted.before),
      after: lifted.after === undefined ? undefined : redact(lifted.after),
      reason: lifted.reason ? String(lifted.reason).slice(0, 1000) : undefined,
      detail: d === undefined ? undefined : redact(d),
      ip: req ? clientIp(req) : undefined,
      userAgent: req?.headers.get("user-agent")?.slice(0, 300),
    });
  } catch (e) {
    console.error("audit write failed", action, e);
  }
}

/** Audit a change to a record: pass the record before and after, and the reason when one is required. */
export const auditChange = (actor: Actor | null, action: string, target: string, c: AuditChange & { detail?: unknown }, req?: Request) =>
  audit(actor, action, target, { ...(c.detail as object), entity: c.entity, entityId: c.entityId, before: c.before, after: c.after, reason: c.reason }, req);

/** Keeps a server error (message and stack only, never request bodies) for 90 days so a request id can be traced. */
export async function logError(e: any, req: Request, requestId: string, user?: string) {
  try {
    const { ErrorLog } = await getDb();
    await ErrorLog.create({
      requestId, method: req.method, path: new URL(req.url).pathname, status: 500,
      message: String(e?.message ?? e).slice(0, 500), stack: String(e?.stack ?? "").split("\n").slice(0, 8).join("\n"), user, ip: clientIp(req),
    });
  } catch { /* never mask the original error */ }
}

export const keyOf = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
