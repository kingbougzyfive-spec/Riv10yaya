import { getDb } from "./db";
import { getFinance } from "./finance";
import { areaRollup, zoneRollup } from "./rollup";
import { obligationFv, totals } from "./verification";

type Id = { type: "parish" | "area" | "zone"; zone: string; area: string | null; parish: string | null; names: any };

/** Everything the report form needs for one unit and month: identity (from database ids), auto-filled counts, existing submissions, bank and percent.
 *  Shared by the signed-in portal and the password-protected fill-in links, so both always show exactly the same thing. */
export async function buildReportContext(id: Id, contact: { fullName: string; phone: string }, month: number, year: number) {
  const { Report, Remittance } = await getDb();

  const existingReport = await Report.findOne({ type: id.type, zone: id.zone, area: id.area, parish: id.parish, month, year }, { _id: 1, submittedAt: 1, status: 1, contact: 1, activity: 1 }).lean<any>();
  const base = { type: id.type, names: id.names, month, year, contact, submitted: existingReport && existingReport.status !== "draft" ? { at: existingReport.submittedAt, status: existingReport.status } : null, draft: existingReport?.status === "draft" ? { contact: existingReport.contact, activity: existingReport.activity } : null };

  if (id.type === "parish") {
    const [finance, yst, levies] = await Promise.all([
      getFinance(),
      Remittance.findOne({ parish: id.parish, month, year, kind: "yst" }).lean<any>(),
      Remittance.find({ parish: id.parish, month, year, kind: "levy" }).lean<any[]>(),
    ]);
    return {
      ...base,
      finance: { percentBp: finance.percentBp, bank: finance.bank },
      remittance: yst ? { id: String(yst._id), status: obligationFv(yst), outstandingKobo: totals(yst).outstandingKobo, confirmedKobo: totals(yst).confirmedKobo, offeringKobo: yst.offeringKobo, requiredKobo: yst.requiredKobo, percentBp: yst.percentBp, amountKobo: yst.amountKobo, paidAt: yst.paidAt, reference: yst.reference } : null,
      levies: levies.map((l) => ({ id: String(l._id), description: l.description, amountKobo: l.amountKobo, status: l.status })),
    };
  }
  if (id.type === "area") return { ...base, rollup: await areaRollup(id.area!, month, year) };
  return { ...base, rollup: await zoneRollup(id.zone, month, year) };
}
