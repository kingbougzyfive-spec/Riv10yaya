import { handle } from "@/lib/api";
import { ApiError } from "@/lib/auth";
import { asFormat, tableResponse } from "@/lib/export";
import { METRICS, recordsFor, type Metric } from "@/lib/finance-dash";
import { loadDash } from "@/lib/finance-load";
import { MONTHS } from "@/lib/money";

export const dynamic = "force-dynamic";
const naira = (k: number) => k / 100;

/** Records behind one summary figure. `format=csv|xlsx|pdf` downloads them. */
export const GET = handle(async (req) => {
  const u = new URL(req.url);
  const metric = u.searchParams.get("metric") as Metric;
  if (!METRICS.includes(metric)) throw new ApiError(400, "Unknown figure.");
  const input = await loadDash(req);
  const rows = recordsFor(metric, input, (m) => MONTHS[m - 1]);
  const fmt = u.searchParams.get("format");
  if (!fmt) return { metric, rows };
  return tableResponse(asFormat(fmt), {
    name: `finance-${metric}-${input.filter.year}${input.filter.month ? "-" + input.filter.month : ""}`, title: `Finance records: ${metric}`, period: `${input.filter.month ? MONTHS[input.filter.month - 1] + " " : "Full year "}${input.filter.year}`, verification: "Confirmed means verified by finance. Pending, needs-action and rejected amounts are not received money.",
    head: ["Parish", "Zone", "Area", "Type", "Period", "Detail", "Amount (NGN)", "Confirmed (NGN)", "Status", "Reference", "Date", "Note"],
    rows: rows.map((r) => [r.parish, r.zone, r.area, r.kind, r.period, r.label, naira(r.amountKobo), naira(r.confirmedKobo), r.status, r.reference, r.at.slice(0, 10), r.note]),
  });
});
