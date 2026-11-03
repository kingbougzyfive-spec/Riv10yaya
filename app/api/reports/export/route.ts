import { ApiError, requireApiUser } from "@/lib/auth";
import { handle } from "@/lib/api";
import { getDb } from "@/lib/db";
import { MONTHS } from "@/lib/money";
import { PERMS } from "@/lib/rbac";
import { CONTACT_ROLES, recordScope } from "@/lib/scope";
import { asFormat, tableResponse } from "@/lib/export";

export const dynamic = "force-dynamic";

/** Report export as CSV, Excel or PDF. Contact columns are included only for roles allowed to see them. */
export const GET = handle(async (req) => {
  const user = await requireApiUser(PERMS.reports);
  const scope = await recordScope(user);
  if (scope === null) throw new ApiError(403, "No access.");
  const q = new URL(req.url).searchParams;
  const f: any = { ...scope };
  for (const k of ["month", "year"]) if (q.get(k)) f[k] = Number(q.get(k));
  if (q.get("type")) f.type = q.get("type");
  const { Report, Remittance } = await getDb();
  const rows = await Report.find(f).sort({ year: -1, month: -1 }).lean<any[]>();
  const rem = new Map<string, any>((await Remittance.find({ _id: { $in: rows.map((r) => r.remittance).filter(Boolean) } }).lean<any[]>()).map((r) => [String(r._id), r]));
  const contact = (CONTACT_ROLES as readonly string[]).includes(user.role);
  const head = ["Level", "Zone", "Area", "Parish", "Month", "Year", "Submitted", ...(contact ? ["Administrator", "Phone", "Alt phone"] : []), "Offering (NGN)", "Required remittance (NGN)", "Remittance status", "Activity (JSON)"];
  const body = rows.map((r) => {
    const m = r.remittance ? rem.get(String(r.remittance)) : null;
    return [r.type, r.names?.zone, r.names?.area, r.names?.parish, MONTHS[r.month - 1], r.year, new Date(r.submittedAt).toISOString().slice(0, 16).replace("T", " "),
      ...(contact ? [r.contact?.fullName, r.contact?.phone, r.contact?.altPhone] : []),
      m ? (m.offeringKobo / 100).toFixed(2) : "", m ? (m.requiredKobo / 100).toFixed(2) : "", m?.status ?? "",
      JSON.stringify({ ...r.activity, ...(r.rollup ? { consolidation: r.rollup } : {}) })];
  });
  const label = `${q.get("month") ? MONTHS[Number(q.get("month")) - 1] + " " : ""}${q.get("year") ?? "All periods"}`;
  return tableResponse(asFormat(q.get("format")), { name: `reports-${q.get("year") ?? "all"}-${q.get("month") ?? "all"}`, title: `Monthly reports: ${label}`, head, rows: body, pdfOmit: ["Activity (JSON)", "Level"] });
});
