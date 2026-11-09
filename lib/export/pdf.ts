import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { blocksFor, lagosStamp, metaItems, tables, type Cell, type Col, type ReportDoc } from "./doc";

const GREEN = rgb(0.04, 0.24, 0.18), INK = rgb(0.1, 0.12, 0.11), MUTE = rgb(0.42, 0.46, 0.44), BAND = rgb(0.95, 0.97, 0.96), LINE = rgb(0.84, 0.88, 0.86), CARD = rgb(0.93, 0.96, 0.94);

/** Standard PDF fonts are Latin-1: map the characters we expect, replace anything else so a PDF never fails. */
export const safe = (s: unknown) => String(s ?? "").replace(/₦/g, "NGN ").replace(/[‘’‚]/g, "'").replace(/[“”„]/g, '"').replace(/[–—]/g, "-").replace(/…/g, "...").replace(/[   ]/g, " ").replace(/[\r\t]+/g, " ").replace(/[^\n\x20-\x7E¡-ÿ]/g, "?");

export function wrap(text: string, font: PDFFont, size: number, width: number, maxLines = 99): string[] {
  const out: string[] = [];
  for (const para of safe(text).split("\n")) {
    let line = "";
    for (let word of para.split(" ")) {
      while (font.widthOfTextAtSize(word, size) > width) { // a single long token: split by characters
        let k = word.length; while (k > 1 && font.widthOfTextAtSize(word.slice(0, k), size) > width) k--;
        if (line) { out.push(line); line = ""; }
        out.push(word.slice(0, k)); word = word.slice(k);
      }
      const t = line ? line + " " + word : word;
      if (font.widthOfTextAtSize(t, size) <= width) line = t; else { out.push(line); line = word; }
    }
    out.push(line);
  }
  if (out.length > maxLines) { const cut = out.slice(0, maxLines); let last = cut[maxLines - 1]; while (last.length > 1 && font.widthOfTextAtSize(last + "...", size) > width) last = last.slice(0, -1); cut[maxLines - 1] = last + "..."; return cut; }
  return out;
}

const money = (n: number) => "NGN " + n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export function fmtCell(v: Cell, kind: Col["kind"] = "text"): string {
  if (v === null || v === undefined || v === "") return "";
  if (typeof v === "number") return kind === "money" ? money(v) : kind === "pct" ? `${v}%` : kind === "int" ? v.toLocaleString("en-NG") : String(v);
  return v;
}
const rightAligned = (k?: Col["kind"]) => k === "money" || k === "int" || k === "pct";

export async function pdfBytes(doc: ReportDoc): Promise<Uint8Array<ArrayBuffer>> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(safe(doc.title)); pdf.setAuthor(safe(doc.org)); pdf.setSubject(safe(doc.period)); pdf.setCreator("YAYA platform"); pdf.setCreationDate(doc.generatedAt);
  const font = await pdf.embedFont(StandardFonts.Helvetica), bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const landscape = Math.max(0, ...tables(doc, "pdf").map((t) => t.cols.length)) > 6;
  const W = landscape ? 842 : 595, H = landscape ? 595 : 842, M = 36, CW = W - 2 * M;
  let page: PDFPage = pdf.addPage([W, H]); let y = H - M; let first = true;
  const pages: PDFPage[] = [page];

  const newPage = () => {
    page = pdf.addPage([W, H]); pages.push(page); y = H - M;
    page.drawText(safe(`${doc.org}  |  ${doc.title}  |  ${doc.period}`), { x: M, y: y - 6, size: 7.5, font, color: MUTE });
    page.drawLine({ start: { x: M, y: y - 12 }, end: { x: W - M, y: y - 12 }, thickness: 0.5, color: LINE }); y -= 28;
  };
  const room = (h: number) => { if (y - h < M + 20) { newPage(); return true; } return false; };

  // ---- letterhead ----
  page.drawRectangle({ x: 0, y: H - 62, width: W, height: 62, color: GREEN });
  page.drawText(safe(doc.org), { x: M, y: H - 30, size: 15, font: bold, color: rgb(1, 1, 1) });
  page.drawText("OFFICIAL REPORT", { x: M, y: H - 47, size: 8, font, color: rgb(0.75, 0.88, 0.82) });
  if (doc.confidential) { const t = "CONFIDENTIAL - FOR OFFICIAL USE"; page.drawText(t, { x: W - M - bold.widthOfTextAtSize(t, 7.5), y: H - 47, size: 7.5, font: bold, color: rgb(0.75, 0.88, 0.82) }); }
  y = H - 62 - 26;
  for (const l of wrap(doc.title, bold, 17, CW, 3)) { page.drawText(l, { x: M, y, size: 17, font: bold, color: GREEN }); y -= 21; }
  y -= 4;

  // ---- meta grid ----
  const meta = metaItems(doc).filter((m) => m.k !== "Organisation" && m.k !== "Report");
  const colN = landscape ? 3 : 2, cw = CW / colN, size = 8.5;
  const cells = meta.map((m) => ({ ...m, lines: wrap(m.v, font, size, cw - 14, 6) }));
  for (let i = 0; i < cells.length; i += colN) {
    const row = cells.slice(i, i + colN); const h = Math.max(...row.map((c) => c.lines.length)) * 11 + 17;
    room(h);
    page.drawRectangle({ x: M, y: y - h + 4, width: CW, height: h, color: CARD });
    row.forEach((c, j) => { const x = M + j * cw + 7; page.drawText(safe(c.k.toUpperCase()), { x, y: y - 8, size: 6.5, font: bold, color: MUTE }); c.lines.forEach((l, k) => page.drawText(l, { x, y: y - 19 - k * 11, size, font: c.k === "Financial verification" ? bold : font, color: INK })); });
    y -= h + 2;
  }
  y -= 6;
  for (const n of doc.notes ?? []) { const ls = wrap(n, font, 8, CW, 6); room(ls.length * 10 + 4); ls.forEach((l) => { page.drawText(l, { x: M, y, size: 8, font, color: MUTE }); y -= 10; }); y -= 4; }
  first = false; void first;

  // ---- blocks ----
  for (const b of blocksFor(doc, "pdf")) {
    if (b.t === "break") { newPage(); continue; }
    if ("title" in b && b.title) { room(b.t === "table" ? 90 : 34); y -= 8; page.drawText(safe(b.title), { x: M, y, size: 11.5, font: bold, color: GREEN }); y -= 5; page.drawLine({ start: { x: M, y }, end: { x: M + CW, y }, thickness: 1, color: GREEN }); y -= 14; }
    if (b.t === "kv") {
      const n = landscape ? 4 : 3, w = CW / n;
      for (let i = 0; i < b.items.length; i += n) {
        const row = b.items.slice(i, i + n); const ls = row.map((it) => wrap(it.v, bold, 11, w - 16, 3)); const h = Math.max(...ls.map((l) => l.length)) * 13 + 24;
        room(h);
        row.forEach((it, j) => { const x = M + j * w; page.drawRectangle({ x: x + 2, y: y - h + 6, width: w - 4, height: h - 2, color: CARD }); page.drawText(safe(it.k.toUpperCase()), { x: x + 8, y: y - 8, size: 6.5, font: bold, color: MUTE }); ls[j].forEach((l, k) => page.drawText(l, { x: x + 8, y: y - 22 - k * 13, size: 11, font: bold, color: INK })); });
        y -= h + 2;
      }
      y -= 6;
    } else if (b.t === "text") {
      for (const p of b.paragraphs) {
        const ls = wrap(p.text || "-", font, 9, CW - 8, 40); const need = Math.min(ls.length, 4) * 12 + (p.label ? 14 : 0) + 6; room(need);
        if (p.label) { page.drawText(safe(p.label), { x: M, y, size: 8.5, font: bold, color: GREEN }); y -= 12; }
        for (const l of ls) { if (y < M + 28) { newPage(); } page.drawText(l, { x: M + 4, y, size: 9, font, color: INK }); y -= 12; }
        y -= 5;
      }
    } else if (b.t === "table") {
      if (!b.rows.length) { room(24); page.drawText(safe(b.empty ?? "No records match these filters."), { x: M, y, size: 9, font, color: MUTE }); y -= 20; continue; }
      const fs = b.cols.length > 9 ? 7 : 8, pad = 4, lh = fs + 3;
      // Column widths: numeric/short columns are never narrower than their widest value or longest header word;
      // the remaining width is shared between text columns by content length and weight.
      const fixedKind = (c: Col) => c.kind === "money" || c.kind === "int" || c.kind === "pct" || c.kind === "center" || c.kind === "date";
      const minW = b.cols.map((c, i) => { const word = Math.max(...safe(c.h).split(" ").map((w) => bold.widthOfTextAtSize(w, fs))); const cellMax = fixedKind(c) ? Math.max(0, ...b.rows.slice(0, 500).map((r) => font.widthOfTextAtSize(safe(fmtCell(r[i], c.kind)), fs)), b.totals ? bold.widthOfTextAtSize(safe(fmtCell(b.totals[i], c.kind)), fs) : 0) : 0; return Math.max(word, cellMax) + pad * 2 + 2; });
      const nat = b.cols.map((c, i) => { if (fixedKind(c)) return minW[i]; const cellsW = b.rows.slice(0, 300).map((r) => font.widthOfTextAtSize(safe(fmtCell(r[i], c.kind)), fs)).sort((a, z) => a - z); const p90 = cellsW[Math.floor(cellsW.length * 0.9)] ?? 0; return Math.min(210, Math.max(minW[i], p90 + pad * 2 + 2)) * (c.w ?? 1); });
      const fixedSum = b.cols.reduce((a, c, i) => a + (fixedKind(c) ? minW[i] : 0), 0);
      const textSum = b.cols.reduce((a, c, i) => a + (fixedKind(c) ? 0 : nat[i]), 0);
      const room2 = Math.max(0, CW - fixedSum);
      let widths = b.cols.map((c, i) => (fixedKind(c) ? minW[i] : textSum ? Math.max(minW[i] * 0.6, (nat[i] / textSum) * room2) : minW[i]));
      const wsum = widths.reduce((a, x) => a + x, 0); widths = widths.map((w) => (w * CW) / wsum);
      const drawHead = () => {
        const hs = b.cols.map((c, i) => wrap(c.h, bold, fs, widths[i] - pad * 2, 4)); const h = Math.max(...hs.map((l) => l.length)) * lh + 6;
        page.drawRectangle({ x: M, y: y - h + lh - 1, width: CW, height: h, color: GREEN });
        let x = M; hs.forEach((ls, i) => { ls.forEach((l, j) => { const tw = bold.widthOfTextAtSize(l, fs); page.drawText(l, { x: rightAligned(b.cols[i].kind) ? x + widths[i] - pad - tw : x + pad, y: y - 2 - j * lh, size: fs, font: bold, color: rgb(1, 1, 1) }); }); x += widths[i]; });
        y -= h + 1;
      };
      room(60); drawHead();
      const drawRow = (r: Cell[], i: number, total = false) => {
        const f = total ? bold : font; const ls = b.cols.map((c, j) => wrap(fmtCell(r[j], c.kind), f, fs, widths[j] - pad * 2, 5)); const h = Math.max(...ls.map((l) => l.length)) * lh + 4;
        if (y - h < M + 22) { newPage(); drawHead(); }
        if (total) { page.drawLine({ start: { x: M, y: y + lh - 1 }, end: { x: M + CW, y: y + lh - 1 }, thickness: 1, color: GREEN }); page.drawRectangle({ x: M, y: y - h + lh - 1, width: CW, height: h, color: CARD }); }
        else if (i % 2) page.drawRectangle({ x: M, y: y - h + lh - 1, width: CW, height: h, color: BAND });
        let x = M; ls.forEach((l, j) => { l.forEach((t, k) => { const tw = f.widthOfTextAtSize(t, fs); page.drawText(t, { x: rightAligned(b.cols[j].kind) ? x + widths[j] - pad - tw : b.cols[j].kind === "center" ? x + (widths[j] - tw) / 2 : x + pad, y: y - 2 - k * lh, size: fs, font: f, color: INK }); }); x += widths[j]; });
        page.drawLine({ start: { x: M, y: y - h + lh - 1 }, end: { x: M + CW, y: y - h + lh - 1 }, thickness: 0.3, color: LINE });
        y -= h;
      };
      b.rows.forEach((r, i) => drawRow(r, i));
      if (b.totals) drawRow(b.totals, 0, true);
      y -= 12;
    }
  }

  // ---- footers on every page ----
  pages.forEach((p, i) => {
    p.drawLine({ start: { x: M, y: 26 }, end: { x: W - M, y: 26 }, thickness: 0.5, color: LINE });
    p.drawText(safe(`Generated ${lagosStamp(doc.generatedAt)} by ${doc.preparedBy}`), { x: M, y: 14, size: 7, font, color: MUTE });
    const t = `Page ${i + 1} of ${pages.length}`; p.drawText(t, { x: W - M - font.widthOfTextAtSize(t, 7), y: 14, size: 7, font, color: MUTE });
  });
  return (await pdf.save()) as Uint8Array<ArrayBuffer>;
}
