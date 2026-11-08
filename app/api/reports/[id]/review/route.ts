import { z } from "zod";
import mongoose from "mongoose";
import { handle, audit } from "@/lib/api";
import { ApiError, requireApiUser, type SessionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { MONTHS } from "@/lib/money";
import { adminsOf, notifyUsers } from "@/lib/notify";
import { REPORT_LABEL, type ReportStatus } from "@/lib/verification";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({ action: z.enum(["complete", "request_revision", "mark_incomplete"]), note: z.string().trim().max(1000).optional().default("") });

/** Who may review which report: the level above it. Nobody reviews their own level's report. */
function canReview(u: SessionUser, r: { type: string; zone: any; area: any }) {
  if (["super_admin", "provincial_admin"].includes(u.role)) return true;
  if (u.role === "zonal_admin") return (r.type === "parish" || r.type === "area") && !!u.zone && String(r.zone) === u.zone;
  if (u.role === "area_admin") return r.type === "parish" && !!u.area && String(r.area) === u.area;
  return false;
}

/** Review a submitted report. Independent of payment verification: this never touches the money side. */
export const POST = handle<Ctx>(async (req, ctx) => {
  const user = await requireApiUser(["super_admin", "provincial_admin", "zonal_admin", "area_admin"]);
  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) throw new ApiError(404, "Report not found.");
  const i = schema.parse(await req.json());
  const { Report } = await getDb();
  const r = await Report.findById(id);
  if (!r) throw new ApiError(404, "Report not found.");
  if (!canReview(user, r)) throw new ApiError(403, "You can't review this report.");
  if (r.status === "draft") throw new ApiError(409, "This report hasn't been submitted yet.");
  if (i.action !== "complete" && i.note.length < 3) throw new ApiError(400, "Please say what needs to change.");
  const status: ReportStatus = { complete: "completed", request_revision: "revision_requested", mark_incomplete: "incomplete" }[i.action] as ReportStatus;
  r.status = status;
  r.reviews.push({ at: new Date(), by: user.id as any, byName: user.name, role: user.role, action: i.action, note: i.note });
  await r.save();
  await audit(user, `report.review.${i.action}`, String(r.reportId ?? r._id), { note: i.note }, req);
  const who = r.names?.parish ?? r.names?.area ?? r.names?.zone;
  await notifyUsers(await adminsOf(r.type === "parish" ? { parish: r.parish } : r.type === "area" ? { area: r.area } : { zone: r.zone }).then((ids) => ids.filter((x) => x !== user.id)), {
    title: `${REPORT_LABEL[status]}: ${who} · ${MONTHS[r.month - 1]} ${r.year}`,
    body: i.note || "Your report was reviewed.",
    link: "/admin/reports",
    event: status === "revision_requested" ? "report_revision" : status === "incomplete" ? "report_incomplete" : "report_completed",
  });
  return { ok: true, status };
});
