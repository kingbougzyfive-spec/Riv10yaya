import { primaryTable, type ReportDoc } from "./doc";

const esc = (v: unknown) => { let s = v === null || v === undefined ? "" : String(v).replace(/\r?\n/g, " "); if (/^[=+\-@]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = "'" + s; return `"${s.replace(/"/g, '""')}"`; };
/** Plain data only: one header row and the records, no letterhead, so spreadsheets and scripts can read it. The first table is exported. Formula-looking text is neutralised. */
export function csvText(doc: ReportDoc): string {
  const t = primaryTable(doc);
  if (!t) throw new Error("This report has no table to export as CSV.");
  return "﻿" + [t.cols.map((c) => c.h), ...t.rows].map((r) => r.map(esc).join(",")).join("\r\n");
}
