import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type Table = { name: string; title: string; head: string[]; rows: (string | number | null | undefined)[][]; pdfOmit?: string[] };
const cell = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const esc = (v: unknown) => `"${cell(v).replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;

export const asFormat = (f: string | null): "csv" | "xlsx" | "pdf" => (f === "xlsx" || f === "pdf" ? f : "csv");

export async function tableResponse(format: "csv" | "xlsx" | "pdf", t: Table): Promise<Response> {
  const file = t.name.replace(/[^a-z0-9\-_.]+/gi, "-");
  if (format === "csv") {
    const body = "﻿" + [t.head, ...t.rows].map((r) => r.map(esc).join(",")).join("\n");
    return new Response(body, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${file}.csv"` } });
  }
  if (format === "xlsx") {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(t.title.slice(0, 31) || "Sheet1", { views: [{ state: "frozen", ySplit: 1 }] });
    ws.addRow(t.head);
    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0B3D2E" } };
    for (const r of t.rows) ws.addRow(r.map((v) => (v === null || v === undefined ? "" : v)));
    ws.columns.forEach((c, i) => { const w = Math.max(t.head[i]?.length ?? 8, ...t.rows.slice(0, 200).map((r) => cell(r[i]).length)); c.width = Math.min(48, Math.max(10, w + 2)); });
    const buf = await wb.xlsx.writeBuffer();
    return new Response(new Uint8Array(buf as ArrayBuffer), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${file}.xlsx"` } });
  }
  return new Response(await pdfBytes(t), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${file}.pdf"` } });
}

async function pdfBytes(t: Table): Promise<Uint8Array<ArrayBuffer>> {
  const keep = t.head.map((h, i) => (t.pdfOmit?.includes(h) ? -1 : i)).filter((i) => i >= 0);
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica), bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = 842, H = 595, M = 32, size = 8, lh = 13;
  const colW = (W - 2 * M) / keep.length;
  // Standard PDF fonts are Latin-1 only; replace anything else so output never fails (₦ → NGN).
  const safe = (s: string) => s.replace(/₦/g, "NGN ").replace(/[^\x20-\x7E -ÿ]/g, "?");
  const fit = (s: string, f: typeof font, w: number) => { let o = safe(s); while (o.length > 1 && f.widthOfTextAtSize(o, size) > w - 4) o = o.slice(0, -2); return o === safe(s) ? o : o + "."; };
  let page = doc.addPage([W, H]), y = H - M;
  const header = () => {
    page.drawText(safe(t.title), { x: M, y, size: 14, font: bold, color: rgb(0.04, 0.24, 0.18) }); y -= 18;
    page.drawText(`Generated ${new Date().toLocaleString("en-NG")}`, { x: M, y, size: 7, font, color: rgb(0.45, 0.45, 0.45) }); y -= 16;
    page.drawRectangle({ x: M - 2, y: y - 4, width: W - 2 * M + 4, height: lh + 2, color: rgb(0.04, 0.24, 0.18) });
    keep.forEach((k, i) => page.drawText(fit(t.head[k], bold, colW), { x: M + i * colW, y, size, font: bold, color: rgb(1, 1, 1) })); y -= lh + 4;
  };
  header();
  t.rows.forEach((r, n) => {
    if (y < M + lh) { page = doc.addPage([W, H]); y = H - M; header(); }
    if (n % 2) page.drawRectangle({ x: M - 2, y: y - 3, width: W - 2 * M + 4, height: lh, color: rgb(0.95, 0.97, 0.96) });
    keep.forEach((k, i) => page.drawText(fit(cell(r[k]), font, colW), { x: M + i * colW, y, size, font, color: rgb(0.1, 0.1, 0.1) })); y -= lh;
  });
  const pages = doc.getPages();
  pages.forEach((p, i) => p.drawText(`Page ${i + 1} of ${pages.length}`, { x: W - M - 50, y: 14, size: 7, font, color: rgb(0.5, 0.5, 0.5) }));
  return (await doc.save()) as Uint8Array<ArrayBuffer>;
}
