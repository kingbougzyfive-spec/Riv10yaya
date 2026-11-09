import { z } from "zod";
import { handle, audit } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { PERMS } from "@/lib/rbac";
import { listFilter, names, orgInput, orgOf, orgOut, resolveOrg } from "@/lib/gov-server";
import { canManage } from "@/lib/governance";
import { memberRows } from "@/lib/gov-shape";

export const dynamic = "force-dynamic";

export const GET = handle(async (req) => {
  const user = await requireApiUser(PERMS.governance);
  const q = new URL(req.url).searchParams;
  const f = listFilter(user, q);
  if (q.get("status")) f.status = q.get("status");
  const { Committee } = await getDb();
  const [rows, n] = await Promise.all([Committee.find(f).sort({ status: 1, level: 1, name: 1 }).limit(300).lean<any[]>(), names()]);
  return { rows: rows.map((c) => ({ id: String(c._id), name: c.name, purpose: c.purpose ?? "", ...orgOut(c, n), status: c.status, formedAt: c.formedAt, responsibilities: c.responsibilities ?? [], members: memberRows(c).filter((m: any) => m.active).length, chair: (c.members ?? []).find((m: any) => m.active && m.role === "chair")?.name ?? null, canManage: canManage(user, orgOf(c)) })) };
});

const body = orgInput.extend({ name: z.string().trim().min(2).max(120), purpose: z.string().trim().max(1000).default(""), responsibilities: z.array(z.string().trim().min(2).max(300)).max(20).default([]) });

export const POST = handle(async (req) => {
  const user = await requireApiUser(PERMS.governanceManage);
  const i = body.parse(await req.json());
  const org = await resolveOrg(user, i);
  const { Committee } = await getDb();
  const now = new Date();
  const c = await Committee.create({ ...org, name: i.name, purpose: i.purpose, responsibilities: i.responsibilities, createdBy: user.id, history: [{ at: now, by: user.id, byName: user.name, action: "formed", note: "" }] });
  await audit(user, "committee.create", `${i.name} (${org.level})`, undefined, req);
  return { id: String(c._id) };
});
