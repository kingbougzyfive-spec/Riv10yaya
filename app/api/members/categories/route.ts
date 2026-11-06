import { z } from "zod";
import { handle, audit } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { getCategories, saveCategories } from "@/lib/member-store";
import { PERMS } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export const GET = handle(async () => { await requireApiUser(PERMS.members); return { list: await getCategories() }; });

const body = z.object({ list: z.array(z.object({ label: z.string().trim().min(2).max(40), active: z.boolean().default(true) })).min(1).max(30) });

/** Categories are managed centrally. Removing one only deactivates it, so existing members keep a valid label. */
export const PUT = handle(async (req) => {
  const user = await requireApiUser(PERMS.orgManage);
  const i = body.parse(await req.json());
  const seen = new Set<string>();
  const list = i.list.map((c) => ({ key: c.label.toLowerCase().replace(/\s+/g, "_"), label: c.label, active: c.active })).filter((c) => !seen.has(c.key) && !!seen.add(c.key));
  await saveCategories(list);
  await audit(user, "member.categories", `${list.length} categories`, list, req);
  return { list };
});
