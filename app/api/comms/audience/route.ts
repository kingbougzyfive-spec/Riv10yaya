import { z } from "zod";
import { handle } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { AUDIENCE_TYPES, resolveAudience } from "@/lib/audience";
import { PERMS } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export const audienceSchema = z.object({ type: z.enum(AUDIENCE_TYPES), ids: z.array(z.string()).max(200).optional(), eventId: z.string().optional() });

/** Dry run: how many people would receive this, before anything is sent. */
export const POST = handle(async (req) => {
  const user = await requireApiUser(PERMS.comms);
  const a = audienceSchema.parse((await req.json()).audience);
  const r = await resolveAudience(user, a);
  return { labels: r.labels, stats: r.stats, capped: r.capped };
});
