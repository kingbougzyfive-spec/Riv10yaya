import { after } from "next/server";
import { aiConfigured } from "@/lib/ai-receipt";
import { AUTO_ACTOR, runAnalysis } from "@/lib/receipt-analysis";
import { financeTeam, notifyUsers } from "@/lib/notify";
import { z } from "zod";
import mongoose from "mongoose";
import { handle, audit } from "@/lib/api";
import { ApiError, requireApiUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { duplicateChecks, flagsFromDuplicates } from "@/lib/receipt-checks";
import { getFinance } from "@/lib/finance";
import { obligationFv, paymentFv, totals } from "@/lib/verification";
import { remittanceKobo, toKobo } from "@/lib/money";
import { periodSchema } from "@/lib/report-config";
import { PERMS } from "@/lib/rbac";
import { recordScope, resolveIdentity } from "@/lib/scope";
import { remittanceSubmitSchema, submitRemittance } from "@/lib/remittance-submit";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // the automatic AI receipt reading runs after the response is sent
export const GET = handle(async (req) => {
  const user = await requireApiUser(PERMS.finance);
  const scope = await recordScope(user);
  if (scope === null) throw new ApiError(403, "No access.");
  const q = new URL(req.url).searchParams;
  const f: any = { ...scope };
  if (q.get("month")) f.month = Number(q.get("month"));
  if (q.get("year")) f.year = Number(q.get("year"));
  if (q.get("kind")) f.kind = q.get("kind");
  const { Remittance, Zone, Area, Parish } = await getDb();
  let [rows, zones, areas, parishes] = await Promise.all([
    Remittance.find(f).sort({ createdAt: -1 }).limit(500).lean<any[]>(),
    Zone.find({}, { name: 1 }).lean<any[]>(), Area.find({}, { name: 1 }).lean<any[]>(), Parish.find({}, { name: 1 }).lean<any[]>(),
  ]);
  const hist = (h: any) => ({ at: h.at, byName: h.byName, action: h.action, note: h.note, reason: h.reason, reference: h.reference, amountKobo: h.amountKobo, paymentId: h.paymentId, evidenceId: h.evidenceId ? String(h.evidenceId) : null });
  const want = q.get("status");
  if (want) rows = rows.filter((r) => obligationFv(r) === want);
  const nm = (l: any[]) => new Map(l.map((x) => [String(x._id), x.name]));
  const [z, a, p] = [nm(zones), nm(areas), nm(parishes)];
  return {
    rows: rows.map((r) => {
      const t = totals(r);
      const pay = (x: any) => ({ id: String(x._id), status: x.status, amountKobo: x.amountKobo, confirmedKobo: x.confirmedKobo, seenKobo: x.seenKobo, paidAt: x.paidAt, reference: x.reference, remarks: x.remarks, evidenceId: x.evidenceId ? String(x.evidenceId) : null, analysis: x.analysis ?? null, flags: flagsFromDuplicates(x.checks), fv: paymentFv(x), history: (x.history ?? []).map(hist) });
      return {
        id: String(r._id), kind: r.kind, month: r.month, year: r.year, status: r.status, description: r.description, fv: obligationFv(r),
        offeringKobo: r.offeringKobo, percentBp: r.percentBp, requiredKobo: r.requiredKobo, amountKobo: r.amountKobo, confirmedKobo: r.confirmedKobo, seenKobo: r.seenKobo,
        totals: t, payments: (r.payments ?? []).map(pay), adjustments: (r.adjustments ?? []).map((a: any) => ({ amountKobo: a.amountKobo, reason: a.reason, byName: a.byName, at: a.at })),
        analysis: r.analysis ?? null, flags: flagsFromDuplicates(r.checks),
        paidAt: r.paidAt, reference: r.reference, remarks: r.remarks, evidenceId: r.evidenceId ? String(r.evidenceId) : null,
        zone: z.get(String(r.zone)), area: r.area ? a.get(String(r.area)) : null, parish: p.get(String(r.parish)), parishId: String(r.parish),
        history: (r.history ?? []).map(hist),
      };
    }),
  };
});

/** Step 1 of the parish monthly flow: remittance + optional separate levies. Activity report can follow immediately. */
export const POST = handle(async (req) => {
  const user = await requireApiUser(["parish_admin"]);
  const i = remittanceSubmitSchema.parse(await req.json());
  const id = await resolveIdentity(user);
  if (!id || id.type !== "parish") throw new ApiError(400, "Your account isn't linked to a parish yet. Ask the Super Administrator.");
  return submitRemittance({ id: user.id, byName: user.name, audit: user }, id, i, req);
});
