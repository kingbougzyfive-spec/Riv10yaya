import { NextResponse } from "next/server";
import { connectionViews, getDb, isDatabaseConfigured } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Public deployment check. Reveals only booleans/counts: no hosts, URIs or secrets. */
export async function GET() {
  const secretOk = !!process.env.APP_SECRET && process.env.APP_SECRET.length >= 16;
  let db = false, dbError: string | undefined;
  if (isDatabaseConfigured()) { try { await getDb(); db = true; } catch (e: any) { db = false; dbError = String(e?.message || e).slice(0, 220); } }
  const body = { ok: db, appSecret: secretOk, databaseConfigured: isDatabaseConfigured(), databaseReachable: db, connections: connectionViews().length, ...(dbError ? { dbError } : {}) };
  return NextResponse.json(body, { status: body.ok ? 200 : 503 });
}
