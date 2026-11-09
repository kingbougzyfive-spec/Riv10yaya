import { z } from "zod";
import { handle, audit } from "@/lib/api";
import { ApiError, requireApiUser } from "@/lib/auth";
import { resolveAudience } from "@/lib/audience";
import { throttle } from "@/lib/ids";
import { dispatch } from "@/lib/notifier";
import { PERMS } from "@/lib/rbac";
import { audienceSchema } from "@/lib/comms-shape";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const body = z.object({
  title: z.string().trim().min(3).max(120),
  body: z.string().trim().max(2000).default(""),
  link: z.string().trim().max(200).optional().refine((v) => !v || (v.startsWith("/") && !v.startsWith("//")), "The link must be a page on this site, starting with /").default(""),
  kind: z.enum(["announcement", "notice"]).default("notice"),
  audience: audienceSchema,
  channels: z.object({ email: z.boolean(), push: z.boolean() }).default({ email: false, push: true }),
});

/** Send an announcement or notice to a chosen audience. In-app always; email and push as chosen and as each person allows. */
export const POST = handle(async (req) => {
  const user = await requireApiUser(PERMS.comms);
  if (!throttle(`comms:${user.id}`, 20, 60 * 60_000)) throw new ApiError(429, "You've sent a lot of messages in the last hour. Please wait a little.");
  const i = body.parse(await req.json());
  const r = await resolveAudience(user, i.audience);
  if (!r.stats.total) throw new ApiError(422, "No one would receive this. Check who you chose.");
  const out = await dispatch({
    event: i.kind === "announcement" ? "announcement" : "general", title: i.title, body: i.body || undefined, link: i.link || undefined,
    userIds: r.userIds, external: r.external, noEmail: r.noEmail, channels: i.channels, origin: "manual", sender: { id: user.id, name: user.name },
    audience: { type: i.audience.type, labels: r.labels.slice(0, 20) },
    anonymousPush: i.audience.type === "everyone" && i.kind === "announcement",
  });
  await audit(user, "comms.send", i.title, { audience: i.audience.type, recipients: out.recipients }, req);
  return { logId: out.logId, recipients: out.recipients, totals: out.totals, capped: r.capped };
});
