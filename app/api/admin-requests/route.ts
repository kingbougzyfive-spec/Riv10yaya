import { handle } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { PERMS } from "@/lib/rbac";

export const dynamic = "force-dynamic";
const ROLE = { zone: "zonal_admin", area: "area_admin", parish: "parish_admin" } as const;

export const GET = handle(async () => {
  await requireApiUser(PERMS.users);
  const { AdminRequest, Zone, Area, Parish, User } = await getDb();
  const rows = await AdminRequest.find({}, { passwordHash: 0 }).sort({ createdAt: -1 }).limit(300).lean<any[]>();
  const nm = async (M: any, ids: any[]) => new Map((await M.find({ _id: { $in: ids.filter(Boolean) } }, { name: 1 }).lean()).map((x: any) => [String(x._id), x.name]));
  const [zn, an, pn] = await Promise.all([nm(Zone, rows.map((r) => r.zone)), nm(Area, rows.map((r) => r.area)), nm(Parish, rows.map((r) => r.parish))]);
  const requests = await Promise.all(rows.map(async (r) => {
    const unitId = r.level === "zone" ? r.zone : r.level === "area" ? r.area : r.parish;
    const existingAdmins = r.status === "pending" && unitId ? await User.countDocuments({ role: ROLE[r.level as keyof typeof ROLE], [r.level]: unitId, active: true }) : 0;
    return {
      id: String(r._id), name: r.name, email: r.email, phone: r.phone || "", level: r.level, status: r.status, createdAt: r.createdAt, reason: r.reason || "", reviewedBy: r.reviewedBy || "",
      zone: r.zone ? zn.get(String(r.zone)) || "" : "", area: r.area ? an.get(String(r.area)) || "" : "", parish: r.parish ? pn.get(String(r.parish)) || "" : "",
      orgName: r.orgName || "", isNew: !unitId, existingAdmins,
    };
  }));
  return { requests, pending: requests.filter((r) => r.status === "pending").length };
});
