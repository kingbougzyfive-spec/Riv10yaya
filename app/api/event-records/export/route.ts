import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { handle } from "@/lib/api";
import { ApiError, requireApiUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { formOverview } from "@/lib/event-records";
import { PERMS } from "@/lib/rbac";

export const dynamic = "force-dynamic";
// Cells that begin with = + - @ would run as formulas when opened in a spreadsheet, so they are defused.
const cell = (v: unknown) => { let s = v == null ? "" : String(v); if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

/** A spreadsheet (CSV) of everything the person is allowed to see for one event form, with the totals at the bottom. */
export const GET = handle(async (req) => {
  const user = await requireApiUser(PERMS.eventRecords);
  const id = new URL(req.url).searchParams.get("form") ?? "";
  if (!mongoose.isValidObjectId(id)) throw new ApiError(400, "Invalid form.");
  const { EventForm } = await getDb();
  const form: any = await EventForm.findById(id).lean();
  if (!form) throw new ApiError(404, "Form not found.");
  const o = await formOverview(user, form);
  const naira = (k: number | null | undefined) => (k == null ? "" : (k / 100).toFixed(2));
  const head = ["Unit", "Zone", "Area", "Males", "Females", "Total", ...(form.collectOffering !== false ? ["Offering (NGN)"] : []), ...form.customFields.map((f: any) => f.label), "Notes", "Filled in by", "Last updated"];
  const lines = [head.map(cell).join(",")];
  for (const u of o.units) {
    const r = u.record;
    lines.push([u.name, u.zone, u.area, r?.males ?? "Not yet", r?.females ?? "", r?.total ?? "", ...(form.collectOffering !== false ? [naira(r?.offeringKobo)] : []), ...form.customFields.map((f: any) => r?.extras?.[f.key] ?? ""), r?.notes ?? "", r?.by ?? "", r?.updatedAt ? new Date(r.updatedAt).toISOString().slice(0, 16).replace("T", " ") : ""].map(cell).join(","));
  }
  const t = o.totals;
  lines.push(["TOTAL", "", "", t.males, t.females, t.total, ...(form.collectOffering !== false ? [naira(t.offeringKobo)] : []), ...form.customFields.map((f: any) => t.extras[f.key] ?? 0), `${t.reported} of ${t.expected} reported`, "", ""].map(cell).join(","));
  const name = `${form.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 60) || "event"}-records.csv`;
  return new NextResponse("\uFEFF" + lines.join("\r\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" } });
});
