import { handle, audit } from "@/lib/api";
import { ApiError, requireApiUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { PERMS } from "@/lib/rbac";
import { pushConfigured, sendPush } from "@/lib/push";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Sends a test notification to every subscribed device so an admin can confirm the setup works. */
export const POST = handle(async (req) => {
  const user = await requireApiUser(PERMS.integrations);
  if (!pushConfigured()) throw new ApiError(400, "Add the VAPID keys first (see the steps on this page).");
  const r = await sendPush({ title: "Test notification", body: "Push notifications are working.", url: "/" });
  await audit(user, "push.test", undefined, r, req);
  return r;
});
