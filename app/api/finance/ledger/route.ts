import { handle, audit } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { backfillLedger, ledgerCheck } from "@/lib/ledger";
import { PERMS } from "@/lib/rbac";

export const dynamic = "force-dynamic";

/** Does the ledger of confirmed money agree with the remittance records? */
export const GET = handle(async () => {
  await requireApiUser(PERMS.financeReview);
  return ledgerCheck(await getDb());
});
/** Fills ledger rows for payments confirmed before the ledger existed. Safe to repeat. */
export const POST = handle(async (req) => {
  const user = await requireApiUser(PERMS.financeReview);
  const out = await backfillLedger(await getDb(), user);
  await audit(user, "finance.ledger_backfill", "ledger", { entity: "ledger", after: { created: out.made } }, req);
  return { made: out.made };
});
