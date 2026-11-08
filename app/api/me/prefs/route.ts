import { z } from "zod";
import { handle } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { OPTIONAL_CATEGORIES } from "@/lib/notify-events";
import { pushConfigured } from "@/lib/push";
import { mailConfigured } from "@/lib/mail";

export const dynamic = "force-dynamic";

/** The signed-in person's own notification settings (any role). */
export const GET = handle(async () => {
  const user = await requireApiUser();
  const { User, PushSub } = await getDb();
  const [u, devices] = await Promise.all([User.findById(user.id, { prefs: 1 }).lean<any>(), PushSub.countDocuments({ user: user.id })]);
  return { prefs: { email: u?.prefs?.email !== false, push: u?.prefs?.push !== false, mute: u?.prefs?.mute ?? [] }, devices, emailAvailable: mailConfigured(), pushAvailable: pushConfigured() };
});

const body = z.object({ email: z.boolean().optional(), push: z.boolean().optional(), mute: z.array(z.string()).max(10).optional() });

/** Only optional categories can be muted; the rest stay on so important notices can't be missed by accident. */
export const PATCH = handle(async (req) => {
  const user = await requireApiUser();
  const i = body.parse(await req.json());
  const set: Record<string, unknown> = {};
  if (i.email !== undefined) set["prefs.email"] = i.email;
  if (i.push !== undefined) set["prefs.push"] = i.push;
  if (i.mute) set["prefs.mute"] = i.mute.filter((c) => (OPTIONAL_CATEGORIES as string[]).includes(c));
  if (Object.keys(set).length) await (await getDb()).User.updateOne({ _id: user.id }, { $set: set });
  return { ok: true };
});

/** Switch off every device for this person (the browser permission itself is the browser's to change). */
export const DELETE = handle(async () => {
  const user = await requireApiUser();
  await (await getDb()).PushSub.deleteMany({ user: user.id });
  return { ok: true };
});
