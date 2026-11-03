import { handle } from "@/lib/api";
import { ApiError, requireApiUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getFinance } from "@/lib/finance";
import { PERMS } from "@/lib/rbac";
import { areaRollup, zoneRollup } from "@/lib/rollup";
import { resolveIdentity } from "@/lib/scope";

export const dynamic = "force-dynamic";

/** Everything the report form needs: identity (from DB ids), auto-filled counts, existing submissions, bank + percent. */
export const GET = handle(async (req) => {
  const user = await requireApiUser(PERMS.reportSubmit);
  const q = new URL(req.url).searchParams;
  const now = new Date();
  const month = Number(q.get("month")) || now.getMonth() + 1;
  const year = Number(q.get("year")) || now.getFullYear();
  const id = await resolveIdentity(user);
  if (!id) throw new ApiError(400, "Your account isn't linked to a zone, area or parish yet. Ask the Super Administrator to assign you.");
  const { Report, Remittance } = await getDb();

  const existingReport = await Report.findOne({ type: id.type, zone: id.zone, area: id.area, parish: id.parish, month, year }, { _id: 1, submittedAt: 1 }).lean<any>();
  const base = { type: id.type, names: id.names, month, year, contact: { fullName: user.name, phone: user.phone ?? "" }, submitted: existingReport ? { at: existingReport.submittedAt } : null };

  if (id.type === "parish") {
    const [finance, yst, levies] = await Promise.all([
      getFinance(),
      Remittance.findOne({ parish: id.parish, month, year, kind: "yst" }).lean<any>(),
      Remittance.find({ parish: id.parish, month, year, kind: "levy" }).lean<any[]>(),
    ]);
    return {
      ...base,
      finance: { percentBp: finance.percentBp, bank: finance.bank },
      remittance: yst ? { id: String(yst._id), status: yst.status, offeringKobo: yst.offeringKobo, requiredKobo: yst.requiredKobo, percentBp: yst.percentBp, amountKobo: yst.amountKobo, paidAt: yst.paidAt, reference: yst.reference } : null,
      levies: levies.map((l) => ({ id: String(l._id), description: l.description, amountKobo: l.amountKobo, status: l.status })),
    };
  }
  if (id.type === "area") return { ...base, rollup: await areaRollup(id.area!, month, year) };
  return { ...base, rollup: await zoneRollup(id.zone, month, year) };
});
