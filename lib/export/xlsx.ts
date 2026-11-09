import ExcelJS from "exceljs";
import { blocksFor, lagosStamp, metaItems, tables, type Block, type Cell, type Col, type ReportDoc } from "./doc";

const GREEN = "FF0B3D2E", BAND = "FFF1F6F3", CARD = "FFE9F2EC", LINE = "FFD3DDD8";
const FMT: Partial<Record<NonNullable<Col["kind"]>, string>> = { money: '"₦"#,##0.00;[Red]-"₦"#,##0.00', int: "#,##0", pct: '0.0"%"' };
const sheetName = (s: string, used: Set<string>) => { let n = s.replace(/[\[\]*?:\\/]/g, " ").trim().slice(0, 31) || "Sheet"; let i = 2; while (used.has(n.toLowerCase())) n = n.slice(0, 28) + ` ${i++}`; used.add(n.toLowerCase()); return n; };
const border = { top: { style: "thin" as const, color: { argb: LINE } }, bottom: { style: "thin" as const, color: { argb: LINE } }, left: { style: "thin" as const, color: { argb: LINE } }, right: { style: "thin" as const, color: { argb: LINE } } };

function letterhead(ws: ExcelJS.Worksheet, doc: ReportDoc, title: string, cols: number, full: boolean): number {
  const span = Math.max(cols, 4);
  const line = (r: number, text: string, o: Partial<ExcelJS.Font> & { fill?: string; h?: number }) => { ws.mergeCells(r, 1, r, span); const c = ws.getCell(r, 1); c.value = text; c.font = { name: "Calibri", ...o }; c.alignment = { vertical: "middle", wrapText: true }; if (o.fill) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: o.fill } }; if (o.h) ws.getRow(r).height = o.h; };
  line(1, doc.org, { bold: true, size: 15, color: { argb: "FFFFFFFF" }, fill: GREEN, h: 26 });
  line(2, title, { bold: true, size: 13, color: { argb: GREEN }, h: 22 });
  line(3, `${doc.period}  |  Generated ${lagosStamp(doc.generatedAt)} by ${doc.preparedBy}${doc.confidential ? "  |  Confidential, for official use" : ""}`, { size: 9, color: { argb: "FF5C6B65" } });
  let r = 4;
  if (full) { for (const m of metaItems(doc).filter((m) => m.k !== "Organisation" && m.k !== "Report")) { ws.getCell(r, 1).value = m.k; ws.getCell(r, 1).font = { bold: true, size: 9, color: { argb: "FF5C6B65" } }; ws.getCell(r, 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: CARD } }; ws.mergeCells(r, 2, r, span); ws.getCell(r, 2).value = m.v; ws.getCell(r, 2).font = { size: 10, bold: m.k === "Financial verification" }; ws.getCell(r, 2).alignment = { wrapText: true, vertical: "top" }; ws.getCell(r, 1).alignment = { vertical: "top" }; ws.getRow(r).height = Math.max(16, Math.ceil(m.v.length / (span * 14)) * 15); r++; } r++; }
  return r;
}

function addTable(ws: ExcelJS.Worksheet, b: Extract<Block, { t: "table" }>, r0: number): number {
  let r = r0;
  if (b.title) { ws.getCell(r, 1).value = b.title; ws.getCell(r, 1).font = { bold: true, size: 12, color: { argb: GREEN } }; r += 1; }
  if (!b.rows.length) { ws.getCell(r, 1).value = b.empty ?? "No records match these filters."; ws.getCell(r, 1).font = { italic: true, color: { argb: "FF5C6B65" } }; return r + 2; }
  const head = r;
  b.cols.forEach((c, i) => { const cell = ws.getCell(r, i + 1); cell.value = c.h; cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 }; cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GREEN } }; cell.alignment = { wrapText: true, vertical: "middle", horizontal: c.kind === "money" || c.kind === "int" || c.kind === "pct" ? "right" : c.kind === "center" ? "center" : "left" }; cell.border = border; });
  ws.getRow(r).height = 30; r++;
  const put = (row: Cell[], i: number, total: boolean) => {
    b.cols.forEach((c, j) => { const cell = ws.getCell(r, j + 1); const v = row[j]; cell.value = v === null || v === undefined ? "" : v; if (typeof v === "number" && FMT[c.kind ?? "text"]) cell.numFmt = FMT[c.kind ?? "text"]!; cell.alignment = { vertical: "top", wrapText: true, horizontal: c.kind === "money" || c.kind === "int" || c.kind === "pct" ? "right" : c.kind === "center" ? "center" : "left" }; cell.border = border; cell.font = { size: 10, bold: total }; if (total) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: CARD } }; else if (i % 2) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BAND } }; });
    r++;
  };
  b.rows.forEach((row, i) => put(row, i, false));
  if (b.totals) put(b.totals, 0, true);
  ws.autoFilter = { from: { row: head, column: 1 }, to: { row: head + b.rows.length, column: b.cols.length } };
  b.cols.forEach((c, i) => { const w = Math.max(c.h.length * 0.8, ...b.rows.slice(0, 300).map((row) => String(row[i] ?? "").length * (c.kind === "money" ? 1.15 : 1))); const col = ws.getColumn(i + 1); col.width = Math.max(col.width ?? 0, Math.min(52, Math.max(11, w + 3)) * (c.w ?? 1)); });
  if (head <= 8) ws.views = [{ state: "frozen", ySplit: head, xSplit: 0 }];
  return r + 1;
}

function setup(ws: ExcelJS.Worksheet, doc: ReportDoc, cols: number, titleRow?: number) {
  ws.pageSetup = { orientation: cols > 6 ? "landscape" : "portrait", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 }, ...(titleRow ? { printTitlesRow: `${titleRow}:${titleRow}` } : {}) };
  ws.headerFooter = { oddFooter: `&L&8${doc.org.replace(/&/g, "&&")} - ${doc.title.replace(/&/g, "&&")}&C&8Generated ${lagosStamp(doc.generatedAt)}&R&8Page &P of &N`.slice(0, 250) };
  ws.properties.tabColor = { argb: GREEN };
}

export async function xlsxBytes(doc: ReportDoc): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.creator = doc.org; wb.title = doc.title; wb.subject = doc.period; wb.created = doc.generatedAt;
  const used = new Set<string>();
  const tbs = tables(doc, "xlsx"); const others = blocksFor(doc, "xlsx").filter((b) => b.t === "kv" || b.t === "text");
  // Sheet 1: the report cover (facts, key figures, narrative). A report that is just one table keeps that table on this sheet.
  const solo = tbs.length === 1 && !others.length;
  const ws = wb.addWorksheet(sheetName(solo ? (tbs[0].sheet ?? "Report") : "Summary", used), { properties: { defaultColWidth: 16 } });
  const maxCols = Math.max(4, ...tbs.map((t) => t.cols.length));
  let r = letterhead(ws, doc, doc.title, solo ? tbs[0].cols.length : 5, true);
  for (const n of doc.notes ?? []) { ws.mergeCells(r, 1, r, 5); ws.getCell(r, 1).value = n; ws.getCell(r, 1).font = { italic: true, size: 9, color: { argb: "FF5C6B65" } }; ws.getCell(r, 1).alignment = { wrapText: true, vertical: "top" }; ws.getRow(r).height = Math.max(15, Math.ceil(n.length / 90) * 13); r++; }
  if (doc.notes?.length) r++;
  let firstHead = 0;
  for (const b of blocksFor(doc, "xlsx")) {
    if (b.t === "kv") { if (b.title) { ws.getCell(r, 1).value = b.title; ws.getCell(r, 1).font = { bold: true, size: 12, color: { argb: GREEN } }; r++; } for (const it of b.items) { ws.getCell(r, 1).value = it.k; ws.getCell(r, 1).font = { size: 10, color: { argb: "FF5C6B65" } }; ws.mergeCells(r, 2, r, 5); ws.getCell(r, 2).value = it.v; ws.getCell(r, 2).font = { bold: true, size: 10 }; ws.getCell(r, 2).alignment = { horizontal: "left" }; r++; } r++; }
    else if (b.t === "text") { if (b.title) { ws.getCell(r, 1).value = b.title; ws.getCell(r, 1).font = { bold: true, size: 12, color: { argb: GREEN } }; r++; } for (const p of b.paragraphs) { if (p.label) { ws.getCell(r, 1).value = p.label; ws.getCell(r, 1).font = { bold: true, size: 10 }; r++; } ws.mergeCells(r, 1, r, 5); ws.getCell(r, 1).value = p.text; ws.getCell(r, 1).alignment = { wrapText: true, vertical: "top" }; ws.getRow(r).height = Math.max(15, Math.ceil(p.text.length / 95) * 14); r++; } r++; }
    else if (b.t === "table" && solo) { firstHead = r + (b.title ? 1 : 0); r = addTable(ws, b, r); }
  }
  if (!solo) { ws.getColumn(1).width = 30; for (let i = 2; i <= 5; i++) ws.getColumn(i).width = 22; }
  setup(ws, doc, solo ? tbs[0].cols.length : 5, firstHead || undefined);
  // One sheet per table when there is more than one block of data.
  if (!solo) for (const t of tbs) {
    const s = wb.addWorksheet(sheetName(t.sheet ?? t.title ?? "Data", used));
    const start = letterhead(s, doc, t.title ?? doc.title, t.cols.length, false);
    const end = addTable(s, { ...t, title: undefined }, start); void end;
    setup(s, doc, t.cols.length, start);
  }
  void maxCols;
  return new Uint8Array((await wb.xlsx.writeBuffer()) as ArrayBuffer);
}
