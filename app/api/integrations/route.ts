import { handle } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { mailConfigured } from "@/lib/mail";
import { getDb } from "@/lib/db";
import { PERMS } from "@/lib/rbac";
import { pushConfigured } from "@/lib/push";
import { smsConfigured } from "@/lib/sms";
import { sheetsConfigured, sheetsServiceEmail } from "@/lib/sheets";
import { effectiveId, getConfig } from "@/lib/sheet-sync";

export const dynamic = "force-dynamic";
async function subscriberCount() { try { return await (await getDb()).PushSub.countDocuments(); } catch { return 0; } }
export const maxDuration = 60;

/** Honest status: an integration is only "active" when its credentials are actually present. */
export const GET = handle(async () => {
  await requireApiUser(PERMS.integrations);
  return {
    email: { active: mailConfigured(), needs: ["RESEND_API_KEY", "MAIL_FROM (optional)"] },
    sheets: { active: sheetsConfigured(effectiveId(await getConfig().catch(() => ({ spreadsheetId: "" } as any)))), serviceEmail: sheetsServiceEmail(), needs: ["GOOGLE_SERVICE_ACCOUNT_JSON", "GOOGLE_SHEET_ID (or set the spreadsheet on the Google Sheets page)"] },
    ai: { active: !!process.env.ANTHROPIC_API_KEY, needs: ["ANTHROPIC_API_KEY", "ANTHROPIC_MODEL (optional)"] },
    sms: { active: smsConfigured(), needs: ["TERMII_API_KEY", "TERMII_SENDER_ID (optional)"] },
    push: { active: pushConfigured(), subscribers: await subscriberCount(), needs: ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT (optional)"] },
  };
});
