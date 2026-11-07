import { z } from "zod";
import { handle, audit } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { PERMS } from "@/lib/rbac";
import { listFilter, names, orgInput, orgOf, orgOut, resolveOrg } from "@/lib/gov-server";
import { canManage } from "@/lib/governance";

export const dynamic = "force-dynamic";

/** Departments the user can see: provincial ones (internal view) plus those at or below their own level. */
export const GET = handle(async (req) => {
  const user = await requireApiUser(PERMS.governance);
  const q = new URL(req.url).searchParams;
  const f = listFilter(user, q);
  const { Department, Member, Appointment } = await getDb();
  // Provincial departments are visible to every administrator (they serve the whole province).
  const vis = { $or: [{ ...f }, ...(q.get("level") ? [] : [{ level: { $in: ["province", null] } }])] };
  const [rows, n] = await Promise.all([Department.find({ active: true, ...vis }).sort({ level: 1, order: 1, name: 1 }).lean<any[]>(), names()]);
  const ids = rows.map((d) => d._id);
  const [counts, heads] = await Promise.all([
    Member.aggregate([{ $match: { departments: { $in: ids } } }, { $unwind: "$departments" }, { $match: { departments: { $in: ids } } }, { $group: { _id: "$departments", n: { $sum: 1 } } }]),
    Appointment.find({ department: { $in: ids }, status: "active" }).lean<any[]>(),
  ]);
  const cnt = new Map(counts.map((c: any) => [String(c._id), c.n]));
  return {
    rows: rows.map((d) => ({
      id: String(d._id), name: d.name, description: d.description ?? "", ...orgOut({ ...d, level: d.level ?? "province" }, n), responsibilities: d.responsibilities ?? [], members: cnt.get(String(d._id)) ?? 0,
      leaders: heads.filter((h) => String(h.department) === String(d._id)).map((h) => ({ id: String(h._id), position: h.position, name: h.holderName })),
      canManage: canManage(user, orgOf({ ...d, level: d.level ?? "province" })), publicSite: (d.level ?? "province") === "province",
    })),
  };
});

const body = orgInput.extend({ name: z.string().trim().min(2).max(100), description: z.string().trim().max(2000).default(""), responsibilities: z.array(z.string().trim().min(2).max(300)).max(20).default([]) });

export const POST = handle(async (req) => {
  const user = await requireApiUser(PERMS.governanceManage);
  const i = body.parse(await req.json());
  const org = await resolveOrg(user, i);
  const { Department } = await getDb();
  const d = await Department.create({ name: i.name, description: i.description, responsibilities: i.responsibilities, ...org, headName: "" });
  await audit(user, "department.create", `${i.name} (${org.level})`, undefined, req);
  return { id: String(d._id) };
});
