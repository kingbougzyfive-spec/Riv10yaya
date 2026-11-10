import type { ClientSession, Connection } from "mongoose";

const noTx = (e: any) => e?.code === 20 || /Transaction numbers are only allowed|replica set|not supported/i.test(String(e?.message ?? ""));

/** Runs `fn` inside a MongoDB transaction so related writes succeed or fail together (MongoDB Atlas supports this).
 *  On a standalone server (a local dev database) transactions don't exist; `fn` then runs once without a session.
 *  Callers must therefore keep writes ordered safely (unique-key writes first) and idempotent, so a partial run can be
 *  repeated without double counting. `session` is undefined in that case; pass it to every operation. */
export async function withTx<T>(conn: Connection, fn: (session?: ClientSession) => Promise<T>): Promise<T> {
  let session: ClientSession;
  try { session = await conn.startSession(); } catch { return fn(undefined); }
  try {
    let out!: T;
    await session.withTransaction(async () => { out = await fn(session); });
    return out;
  } catch (e) {
    if (noTx(e)) return fn(undefined);
    throw e;
  } finally {
    await session.endSession();
  }
}
