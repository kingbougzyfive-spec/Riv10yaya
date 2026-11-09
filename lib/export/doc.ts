/** The shape every official report is built into, whatever format it is exported in. Client-safe. */
export type Cell = string | number | null | undefined;
export type ColKind = "text" | "int" | "money" | "pct" | "date" | "center";
export type Col = { h: string; kind?: ColKind; w?: number };
export type Only = { only?: "pdf" | "xlsx" };
export type Block = Only & (
  | { t: "kv"; title?: string; items: { k: string; v: string }[] }
  | { t: "table"; title?: string; sheet?: string; cols: Col[]; rows: Cell[][]; totals?: Cell[]; empty?: string; csv?: boolean }
  | { t: "text"; title?: string; paragraphs: { label?: string; text: string }[] }
  | { t: "break" }
);
export type Format = "pdf" | "xlsx" | "csv";
export type ReportDoc = {
  file: string; title: string; org: string; period: string; generatedAt: Date; preparedBy: string; scope: string;
  filters: string[]; verification?: string; administrator?: string; notes?: string[]; blocks: Block[]; formats: Format[]; confidential: boolean;
};

export const FORMAT_MIME: Record<Format, string> = { pdf: "application/pdf", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", csv: "text/csv; charset=utf-8" };
export const safeFile = (s: string) => s.replace(/[^a-z0-9\-_.]+/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 90) || "report";
/** Africa/Lagos is a fixed UTC+1. */
export function lagosStamp(d: Date) {
  const l = new Date(d.getTime() + 3600_000);
  const M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${l.getUTCDate()} ${M[l.getUTCMonth()]} ${l.getUTCFullYear()}, ${String(l.getUTCHours()).padStart(2, "0")}:${String(l.getUTCMinutes()).padStart(2, "0")} (Lagos)`;
}
/** Blocks meant for this format (long narrative is PDF-only, wide data grids are Excel-only). */
export const blocksFor = (d: ReportDoc, f: Format) => d.blocks.filter((b) => !b.only || b.only === f);
export const tables = (d: ReportDoc, f?: Format) => (f ? blocksFor(d, f) : d.blocks).filter((b): b is Extract<Block, { t: "table" }> => b.t === "table");
export const primaryTable = (d: ReportDoc) => tables(d).find((t) => t.csv !== false);
/** The facts printed at the top of every export. */
export function metaItems(d: ReportDoc): { k: string; v: string }[] {
  return [
    { k: "Organisation", v: d.org }, { k: "Report", v: d.title }, { k: "Reporting period", v: d.period }, { k: "Date generated", v: lagosStamp(d.generatedAt) },
    { k: "Prepared by", v: d.preparedBy }, { k: "Records covered", v: d.scope },
    ...(d.administrator ? [{ k: "Administrator", v: d.administrator }] : []),
    ...(d.filters.length ? [{ k: "Filters applied", v: d.filters.join("; ") }] : []),
    ...(d.verification ? [{ k: "Financial verification", v: d.verification }] : []),
  ];
}
