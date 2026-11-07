import { z } from "zod";
import { handle, audit } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { PERMS } from "@/lib/rbac";
import { loadGov } from "@/lib/gov-server";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

const body = z.object({ name: z.string().trim().min(2).max(100).optional(), description: z.string().trim().max(2000).optional(), responsibilities: z.array(z.string().trim().min(2).max(300)).max(20).optional(), active: z.boolean().optional() });

/** Provincial departments (which feed the public site) can be edited here too, but only by provincial administrators. */
export const PATCH = handle<Ctx>(async (req, ctx) => {
  const user = await requireApiUser(PERMS.governanceManage);
  const d = await loadGov("Department", (await ctx.params).id, user, true);
  const i = body.parse(await req.json());
  Object.assign(d, i);
  await d.save();
  await audit(user, "department.update", d.name, i.active === false ? { archived: true } : undefined, req);
  return { ok: true };
});
