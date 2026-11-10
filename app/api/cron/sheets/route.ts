import { timingSafeEqual } from "node:crypto";
import { handle, audit } from "@/lib/api";
import { ApiError } from "@/lib/auth";
import { getConfig, runSync } from "@/lib/sheet-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Daily scheduled sync (Vercel Cron sends `Authorization: Bearer $CRON_SECRET`). Also re-tries anything that failed. Does nothing unless "Sync automatically" is on. */
export const GET = handle(async (req) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new ApiError(503, "CRON_SECRET isn't set, so scheduled sync is switched off.");
  const got = Buffer.from(req.headers.get("authorization") ?? ""), want = Buffer.from(`Bearer ${secret}`);
  if (got.length !== want.length || !timingSafeEqual(got, want)) throw new ApiError(401, "Not allowed.");
  const c = await getConfig();
  if (!c.auto) return { ran: false, note: "Automatic sync is switched off." };
  const out = await runSync({ trigger: "auto" });
  await audit({ id: "", name: "Scheduled sync" }, "sheets.sync", "automatic", { entity: "sheets", after: { trigger: "auto", ok: (out as any)?.ok ?? null } }, req);
  return { ran: true, ...out };
});
