import mongoose from "mongoose";
import { handle, audit } from "@/lib/api";
import { ApiError, requireApiUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { isProvincialAdmin } from "@/lib/governance";
import { sendMailResult } from "@/lib/mail";
import { appUrl } from "@/lib/ids";
import { pushToSubs } from "@/lib/push";
import { PERMS } from "@/lib/rbac";
import { shapeLog } from "@/lib/comms-shape";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

async function load(id: string, user: any) {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(404, "Not found.");
  const l = await (await getDb()).NotificationLog.findById(id);
  if (!l || (!isProvincialAdmin(user.role) && String(l.sentBy) !== user.id)) throw new ApiError(404, "Not found.");
  return l;
}

export const GET = handle<Ctx>(async (_req, ctx) => {
  const user = await requireApiUser(PERMS.comms);
  const l = await load((await ctx.params).id, user);
  return { log: { ...shapeLog(l), body: l.body, link: l.link, labels: l.audience?.labels ?? [] }, failures: (l.failures ?? []).map((f: any) => ({ id: String(f._id), channel: f.channel, name: f.name, to: f.to, error: f.error, retried: f.retried })) };
});

/** Try the failed deliveries again (email and push). Successful ones are marked and the counts updated. */
export const POST = handle<Ctx>(async (req, ctx) => {
  const user = await requireApiUser(PERMS.comms);
  const l = await load((await ctx.params).id, user);
  const { PushSub } = await getDb();
  let fixed = 0, still = 0;
  for (const f of l.failures) {
    if (f.retried) continue;
    let ok = false;
    if (f.channel === "email" && f.to) ok = (await sendMailResult({ to: f.to, subject: l.title, html: `<p>${(l.body ?? "").replace(/[&<>]/g, (c: string) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!)}</p>${l.link ? `<p><a href="${appUrl()}${l.link}">Open</a></p>` : ""}` })).ok;
    else if (f.channel === "push" && f.user) { const subs = await PushSub.find({ user: f.user }).lean<any[]>(); ok = [...(await pushToSubs(subs, { title: l.title, body: l.body, url: l.link })).values()].some((r) => r.ok); }
    if (ok) { f.retried = true; fixed++; l.totals[f.channel === "email" ? (f.user ? "emailSent" : "externalSent") : "pushSent"] += 1; l.totals[f.channel === "email" ? (f.user ? "emailFailed" : "externalFailed") : "pushFailed"] -= 1; } else still++;
  }
  l.markModified("totals");
  l.status = l.failures.every((f: any) => f.retried) ? "done" : l.status;
  await l.save();
  await audit(user, "comms.retry", l.title, { fixed, still }, req);
  return { fixed, still };
});
