import { handle } from "@/lib/api";
import { ApiError, requireApiUser } from "@/lib/auth";
import { PERMS } from "@/lib/rbac";
import { buildReportContext } from "@/lib/report-context";
import { resolveIdentity } from "@/lib/scope";

export const dynamic = "force-dynamic";

/** Everything the report form needs: identity (from DB ids), auto-filled counts, existing submissions, bank + percent. */
export const GET = handle(async (req) => {
  const user = await requireApiUser(PERMS.reportSubmit);
  const q = new URL(req.url).searchParams;
  const now = new Date();
  const month = Number(q.get("month")) || now.getMonth() + 1;
  const year = Number(q.get("year")) || now.getFullYear();
  const id = await resolveIdentity(user);
  if (!id) throw new ApiError(400, "Your account isn't linked to a zone, area or parish yet. Ask the Super Administrator to assign you.");
  return buildReportContext(id, { fullName: user.name, phone: user.phone ?? "" }, month, year);
});
