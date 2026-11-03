import { z } from "zod";
import { handle } from "@/lib/api";
import { ApiError } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { throttle } from "@/lib/ids";
import { pushConfigured, pushPublicKey } from "@/lib/push";

export const dynamic = "force-dynamic";

/** Tells the browser whether push is available and which public key to subscribe with. */
export const GET = handle(async () => ({ enabled: pushConfigured(), key: pushConfigured() ? pushPublicKey() : "" }));

const sub = z.object({ endpoint: z.string().url().max(1000), keys: z.object({ p256dh: z.string().max(300), auth: z.string().max(100) }) });
const ip = (req: Request) => req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";

export const POST = handle(async (req) => {
  if (!pushConfigured()) throw new ApiError(400, "Notifications are not switched on for this site yet.");
  if (!throttle(`push:${ip(req)}`, 10, 10 * 60_000)) throw new ApiError(429, "Too many attempts. Please try again later.");
  const i = sub.parse(await req.json());
  const { PushSub } = await getDb();
  await PushSub.updateOne({ endpoint: i.endpoint }, { $set: { p256dh: i.keys.p256dh, auth: i.keys.auth, ua: (req.headers.get("user-agent") || "").slice(0, 200) } }, { upsert: true });
  return { ok: true };
});

export const DELETE = handle(async (req) => {
  const { endpoint } = z.object({ endpoint: z.string().url().max(1000) }).parse(await req.json());
  const { PushSub } = await getDb();
  await PushSub.deleteOne({ endpoint });
  return { ok: true };
});
