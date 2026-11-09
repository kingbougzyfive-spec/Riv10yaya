import { handle } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { resolveAudience } from "@/lib/audience";
import { PERMS } from "@/lib/rbac";
import { audienceSchema } from "@/lib/comms-shape";

export const dynamic = "force-dynamic";

/** Dry run: how many people would receive this, before anything is sent. */
export const POST = handle(async (req) => {
  const user = await requireApiUser(PERMS.comms);
  const a = audienceSchema.parse((await req.json()).audience);
  const r = await resolveAudience(user, a);
  return { labels: r.labels, stats: r.stats, capped: r.capped };
});
