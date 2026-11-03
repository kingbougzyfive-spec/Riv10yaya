import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ApiError } from "./auth";
import { AllDatabasesFailedError, NoDatabaseError, getDb } from "./db";
import type { SessionUser } from "./auth";

type Handler<C> = (req: Request, ctx: C) => Promise<Response | object>;

/** Wraps a route handler: consistent JSON errors for validation, auth and database problems. */
export function handle<C = unknown>(fn: Handler<C>) {
  return async (req: Request, ctx: C) => {
    try {
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
      console.error(e);
      return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
    }
  };
}

export async function audit(actor: SessionUser | null, action: string, target?: string, detail?: unknown, req?: Request) {
  try {
    const { Audit } = await getDb();
    await Audit.create({
      actor: actor?.id,
      actorName: actor?.name,
      action,
      target,
      detail,
      ip: req?.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
    });
  } catch {
    /* auditing must never break the main action */
  }
}

export const keyOf = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
