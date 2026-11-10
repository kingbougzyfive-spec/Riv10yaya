import { z } from "zod";
import { handle, audit } from "@/lib/api";
import { ApiError, requireApiUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { newRef } from "@/lib/ledger-core";
import { PERMS } from "@/lib/rbac";

export const dynamic = "force-dynamic";
const createSchema = z.object({
  category: z.enum(["levy", "contribution"]),
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(1000).optional(),
  amount: z.number().positive().max(1e9).optional(),
  target: z.number().positive().max(1e12).optional(),
  dueAt: z.string().datetime().optional(),
  zones: z.array(z.string()).max(100).optional(),
  areas: z.array(z.string()).max(300).optional(),
  parishes: z.array(z.string()).max(2000).optional(),
});
const kobo = (n?: number) => (n === undefined ? undefined : Math.round(n * 100));

/** Province-set levies and voluntary contribution appeals. */
export const GET = handle(async () => {
  await requireApiUser(PERMS.finance);
  const { AdditionalLevy, Contribution } = await getDb();
  const [l, c] = await Promise.all([AdditionalLevy.find().sort({ createdAt: -1 }).limit(200).lean<any[]>(), Contribution.find().sort({ createdAt: -1 }).limit(200).lean<any[]>()]);
  const row = (d: any) => ({ id: String(d._id), ref: d.ref, category: d.category, title: d.title, description: d.description ?? null, amountKobo: d.amountKobo ?? null, targetKobo: d.targetKobo ?? null, dueAt: d.dueAt ?? null, status: d.status, appliesTo: { zones: (d.appliesTo?.zones ?? []).map(String), areas: (d.appliesTo?.areas ?? []).map(String), parishes: (d.appliesTo?.parishes ?? []).map(String) } });
  return { levies: l.map(row), contributions: c.map(row) };
});

export const POST = handle(async (req) => {
  const user = await requireApiUser(PERMS.financeReview);
  const i = createSchema.parse(await req.json());
  if (i.category === "levy" && !i.amount) throw new ApiError(400, "A levy needs the amount each parish owes.");
  const db = await getDb();
  const M = i.category === "levy" ? db.AdditionalLevy : db.Contribution;
  const d = await M.create({ ref: newRef(i.category === "levy" ? "LEV" : "CON"), title: i.title, description: i.description, amountKobo: kobo(i.amount), targetKobo: kobo(i.target), dueAt: i.dueAt ? new Date(i.dueAt) : undefined, appliesTo: { zones: i.zones ?? [], areas: i.areas ?? [], parishes: i.parishes ?? [] }, createdBy: user.id, history: [{ by: user.id, byName: user.name, action: "created" }] });
  await audit(user, `finance.${i.category}.create`, i.title, { entity: i.category, entityId: String(d._id), after: { ref: d.ref, amountKobo: d.amountKobo ?? null, dueAt: d.dueAt ?? null } }, req);
  return { id: String(d._id), ref: d.ref };
});
