import { handle } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { matchTyped } from "@/lib/admin-request";
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
    // Older requests picked from a list; newer ones are typed text.
    const zoneName = r.zoneName || (r.zone ? zn.get(String(r.zone)) : "") || "";
    const areaName = r.areaName || (r.area ? an.get(String(r.area)) : "") || "";
    const parishName = r.parishName || (r.parish ? pn.get(String(r.parish)) : "") || "";
    const base = { id: String(r._id), name: r.name, email: r.email, phone: r.phone || "", level: r.level, status: r.status, createdAt: r.createdAt, reason: r.reason || "", reviewedBy: r.reviewedBy || "", zoneName, areaName, parishName, orgName: r.orgName || (r.level === "zone" ? zoneName : r.level === "area" ? areaName : parishName) };
    if (r.status !== "pending") return { ...base, zoneId: "", areaId: "", parishId: "", unitIsNew: false, existingAdmins: 0 };
    const m = await matchTyped({ level: r.level, zoneName, areaName, parishName, zone: r.zone, area: r.area, parish: r.parish });
    const unit = r.level === "zone" ? m.zone : r.level === "area" ? m.area : m.parish;
    const existingAdmins = unit ? await User.countDocuments({ role: ROLE[r.level as keyof typeof ROLE], [r.level]: unit._id, active: true }) : 0;
    return { ...base, zoneId: m.zone ? String(m.zone._id) : "", areaId: m.area ? String(m.area._id) : "", parishId: m.parish ? String(m.parish._id) : "", zoneHasAreas: m.zone ? !!m.zone.hasAreas : null, unitIsNew: !unit, existingAdmins };
  }));
  return { requests, pending: requests.filter((r) => r.status === "pending").length };
});
