import { NextResponse } from "next/server";
import { connectionViews, getDb, isDatabaseConfigured } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Public deployment check. Reveals only booleans/counts: no hosts, URIs or secrets. */
export async function GET() {
  const secretOk = !!process.env.APP_SECRET && process.env.APP_SECRET.length >= 16;
  let db = false;
  if (isDatabaseConfigured()) { try { await getDb(); db = true; } catch { db = false; } }
  const body = { ok: secretOk && db, appSecret: secretOk, databaseConfigured: isDatabaseConfigured(), databaseReachable: db, connections: connectionViews().length };
  return NextResponse.json(body, { status: body.ok ? 200 : 503 });
}
