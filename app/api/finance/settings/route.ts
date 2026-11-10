import { z } from "zod";
import { handle, audit } from "@/lib/api";
import { ApiError, requireApiUser } from "@/lib/auth";
import { getFinance, saveFinance } from "@/lib/finance";
import { can, PERMS } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const user = await requireApiUser(PERMS.finance);
  const s = await getFinance();
  return { ...s, canEditPercent: can(user.role, "percentEdit"), canEditBank: can(user.role, "bankEdit") };
});

const schema = z.object({
  percent: z.number().min(0.01).max(100).optional(), // e.g. 40 or 37.5
  bank: z.object({ bankName: z.string().max(80), accountName: z.string().max(120), accountNumber: z.string().regex(/^\d{10}$/, "Account number must be 10 digits"), instructions: z.string().max(600) }).optional(),
});

export const PUT = handle(async (req) => {
  const user = await requireApiUser(PERMS.finance);
  const i = schema.parse(await req.json());
  const cur = await getFinance();
  const beforeSnap = { percentBp: cur.percentBp, bank: { ...cur.bank } };
  const at = new Date().toISOString();
  if (i.percent !== undefined) {
    if (!can(user.role, "percentEdit")) throw new ApiError(403, "Only provincial administrators can change the remittance percentage.");
    const bp = Math.round(i.percent * 100);
    if (bp !== cur.percentBp) cur.history.unshift({ at, byName: user.name, field: "remittance %", from: `${cur.percentBp / 100}%`, to: `${bp / 100}%` });
    cur.percentBp = bp;
  }
  if (i.bank) {
    if (!can(user.role, "bankEdit")) throw new ApiError(403, "Only finance administrators can change the bank details.");
    const b = cur.bank;
    for (const k of ["bankName", "accountName", "accountNumber"] as const) if (b[k] !== i.bank[k]) cur.history.unshift({ at, byName: user.name, field: k, from: b[k] || "—", to: i.bank[k] });
    cur.bank = i.bank;
  }
  cur.history = cur.history.slice(0, 100);
  await saveFinance(cur);
  await audit(user, "finance.settings", "finance", { entity: "finance_settings", before: beforeSnap, after: { percentBp: cur.percentBp, bank: { ...cur.bank } } }, req);
  return { ok: true };
});
