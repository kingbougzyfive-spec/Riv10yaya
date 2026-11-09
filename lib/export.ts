import { getSite } from "./cms";
import { getUser } from "./auth";
import { csvText } from "./export/csv";
import { FORMAT_MIME, safeFile, type Format, type ReportDoc } from "./export/doc";
import { pdfBytes } from "./export/pdf";
import { xlsxBytes } from "./export/xlsx";
import { ROLE_LABELS } from "./roles";

/** A plain table handed over by an on-screen list. It is dressed as an official report: organisation, period, who and when. */
export type Table = { name: string; title: string; head: string[]; rows: (string | number | null | undefined)[][]; pdfOmit?: string[]; period?: string; scope?: string; filters?: string[]; verification?: string; confidential?: boolean };

export const asFormat = (f: string | null): "csv" | "xlsx" | "pdf" => (f === "xlsx" || f === "pdf" ? f : "csv");
const isMoney = (h: string) => /\(NGN\)|amount|₦/i.test(h);

export async function tableResponse(format: Format, t: Table): Promise<Response> {
  const [user, { site }] = await Promise.all([getUser(), getSite()]);
  const omit = format === "pdf" ? new Set(t.pdfOmit ?? []) : new Set<string>();
  const keep = t.head.map((h, i) => (omit.has(h) ? -1 : i)).filter((i) => i >= 0);
  const money = (i: number) => isMoney(t.head[i]) && t.rows.every((r) => r[i] === null || r[i] === undefined || r[i] === "" || Number.isFinite(Number(r[i])));
  const doc: ReportDoc = {
    file: safeFile(t.name), title: t.title, org: `RCCG ${site.brand.name}`.replace(/^RCCG RCCG/i, "RCCG"), period: t.period ?? "As at date generated", generatedAt: new Date(),
    preparedBy: user ? `${user.name} (${ROLE_LABELS[user.role as keyof typeof ROLE_LABELS] ?? user.role})` : "Platform", scope: t.scope ?? "Records within the viewer's access", filters: t.filters ?? [], verification: t.verification, confidential: t.confidential ?? true,
    formats: ["pdf", "xlsx", "csv"],
    blocks: [{ t: "table", title: t.title, sheet: "Report", cols: keep.map((i) => ({ h: t.head[i], kind: money(i) ? "money" as const : "text" as const })), rows: t.rows.map((r) => keep.map((i) => (money(i) && r[i] !== "" && r[i] !== null && r[i] !== undefined ? Number(r[i]) : r[i]))), empty: "No records match these filters." }],
  };
  const stamp = new Date(Date.now() + 3600_000).toISOString().slice(0, 10);
  const body = format === "pdf" ? await pdfBytes(doc) : format === "xlsx" ? await xlsxBytes(doc) : csvText(doc);
  return new Response(body as BodyInit, { headers: { "Content-Type": FORMAT_MIME[format], "Content-Disposition": `attachment; filename="${doc.file}-${stamp}.${format}"`, "Cache-Control": "no-store" } });
}
