import { handle } from "@/lib/api";
import { ApiError, requireApiUser } from "@/lib/auth";
import { runReminders } from "@/lib/reminders";
import { isProvincialAdmin } from "@/lib/governance";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Called daily by the scheduler (Vercel Cron sends `Authorization: Bearer $CRON_SECRET`). Refuses to run without a secret. */
export const GET = handle(async (req) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new ApiError(503, "CRON_SECRET isn't set, so scheduled reminders are switched off.");
  if (req.headers.get("authorization") !== `Bearer ${secret}`) throw new ApiError(401, "Not allowed.");
  return runReminders();
});

/** Provincial administrators can run it by hand from the Communications page. Safe to repeat: nobody is notified twice. */
export const POST = handle(async () => {
  const user = await requireApiUser(["super_admin", "provincial_admin"]);
  if (!isProvincialAdmin(user.role)) throw new ApiError(403, "Not allowed.");
  return runReminders();
});
