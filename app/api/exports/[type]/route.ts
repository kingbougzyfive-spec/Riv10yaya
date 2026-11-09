import { audit, handle } from "@/lib/api";
import { ApiError, requireApiUser } from "@/lib/auth";
import { buildExport } from "@/lib/export/build";
import { EXPORT_BY_KEY, isExportType } from "@/lib/export/catalog";
import { FORMAT_MIME, primaryTable, tables, type Format } from "@/lib/export/doc";
import { csvText } from "@/lib/export/csv";
import { pdfBytes } from "@/lib/export/pdf";
import { xlsxBytes } from "@/lib/export/xlsx";
import { PERMS } from "@/lib/rbac";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * One endpoint for every official report. Access is checked per report type and the data is cut to the person's scope
 * in buildExport. Without `format` it returns a preview (header facts, key figures, first rows) so filters can be checked
 * before anything is downloaded. Every download is audited.
 */
export const GET = handle(async (req, { params }: { params: Promise<{ type: string }> }) => {
  const { type } = await params;
  const user = await requireApiUser(PERMS.exportAny);
  if (!isExportType(type)) throw new ApiError(404, "Unknown report.");
  const q = new URL(req.url).searchParams;
  const doc = await buildExport(type, user, q);
  const fmt = q.get("format") as Format | null;
  if (!fmt) {
    return {
      type, title: doc.title, org: doc.org, period: doc.period, generatedAt: doc.generatedAt, preparedBy: doc.preparedBy, scope: doc.scope, filters: doc.filters, verification: doc.verification ?? null, administrator: doc.administrator ?? null, notes: doc.notes ?? [], formats: doc.formats.filter((f) => EXPORT_BY_KEY[type].formats.includes(f)),
      blocks: doc.blocks.filter((b) => b.t === "kv" || b.t === "table").map((b) => b.t === "kv" ? { t: "kv", title: b.title, items: b.items } : b.t === "table" ? { t: "table", title: b.title, cols: b.cols, total: b.rows.length, rows: b.rows.slice(0, 8), totals: b.totals ?? null } : null),
      records: primaryTable(doc)?.rows.length ?? tables(doc)[0]?.rows.length ?? 0,
    };
  }
  if (!["pdf", "xlsx", "csv"].includes(fmt) || !doc.formats.includes(fmt) || !EXPORT_BY_KEY[type].formats.includes(fmt)) throw new ApiError(400, "That format isn't available for this report.");
  const body = fmt === "pdf" ? await pdfBytes(doc) : fmt === "xlsx" ? await xlsxBytes(doc) : csvText(doc);
  await audit(user, "report.export", `${doc.title} (${fmt})`, { type, format: fmt, period: doc.period, filters: Object.fromEntries(q), records: primaryTable(doc)?.rows.length ?? null }, req);
  const stamp = new Date(Date.now() + 3600_000).toISOString().slice(0, 10);
  return new Response(body as BodyInit, { headers: { "Content-Type": FORMAT_MIME[fmt], "Content-Disposition": `attachment; filename="${doc.file}-${stamp}.${fmt}"`, "Cache-Control": "no-store" } });
});
