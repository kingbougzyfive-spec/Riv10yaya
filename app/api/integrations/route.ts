import { z } from "zod";
import { handle, audit } from "@/lib/api";
import { ApiError, requireApiUser } from "@/lib/auth";
import { buildDataset } from "@/lib/datasets";
import { mailConfigured } from "@/lib/mail";
import { PERMS } from "@/lib/rbac";
import { sheetsConfigured, sheetsServiceEmail, writeTab } from "@/lib/sheets";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Honest status: an integration is only "active" when its credentials are actually present. */
export const GET = handle(async () => {
  await requireApiUser(PERMS.integrations);
  return {
    email: { active: mailConfigured(), needs: ["RESEND_API_KEY", "MAIL_FROM (optional)"] },
    sheets: { active: sheetsConfigured(), serviceEmail: sheetsServiceEmail(), needs: ["GOOGLE_SERVICE_ACCOUNT_JSON", "GOOGLE_SHEET_ID"] },
    ai: { active: !!process.env.ANTHROPIC_API_KEY, needs: ["ANTHROPIC_API_KEY", "ANTHROPIC_MODEL (optional)"] },
    push: { active: false, needs: ["Not built yet"] },
  };
});

export const POST = handle(async (req) => {
  const user = await requireApiUser(PERMS.integrations);
  const { dataset } = z.object({ dataset: z.enum(["reports", "remittances", "attendance"]) }).parse(await req.json());
  if (!sheetsConfigured()) throw new ApiError(400, "Google Sheets isn't configured yet. Add the two environment variables shown on this page.");
  if (dataset === "remittances" && !["super_admin", "finance_admin"].includes(user.role)) throw new ApiError(403, "Only finance administrators can sync financial data.");
  const d = await buildDataset(dataset);
  try {
    const n = await writeTab(d.tab, d.head, d.rows);
    await audit(user, "sheets.sync", dataset, { rows: n }, req);
    return { ok: true, tab: d.tab, rows: n };
  } catch (e: any) { throw new ApiError(502, e.message || "Google Sheets rejected the update."); }
});
