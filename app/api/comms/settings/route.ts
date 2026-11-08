import { z } from "zod";
import { handle, audit } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { mailConfigured } from "@/lib/mail";
import { pushConfigured } from "@/lib/push";
import { getReminderConfig, saveReminderConfig } from "@/lib/reminders";

export const dynamic = "force-dynamic";
const ADMIN = ["super_admin", "provincial_admin"];

export const GET = handle(async () => {
  await requireApiUser(ADMIN);
  return { config: await getReminderConfig(), cronConfigured: !!process.env.CRON_SECRET, email: mailConfigured(), push: pushConfigured() };
});

const body = z.object({ enabled: z.boolean(), reportDeadlineDay: z.number().int().min(1).max(28), reportLeadDays: z.array(z.number().int().min(1).max(14)).max(4), eventHoursAhead: z.number().int().min(6).max(96), meetingHoursAhead: z.number().int().min(6).max(96), outstandingEveryDays: z.number().int().min(2).max(30) });

export const PUT = handle(async (req) => {
  const user = await requireApiUser(ADMIN);
  const c = await saveReminderConfig(body.parse(await req.json()));
  await audit(user, "comms.settings", "reminders", undefined, req);
  return { config: c };
});
