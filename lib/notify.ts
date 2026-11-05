import { getDb } from "./db";
import { mailConfigured, sendMail } from "./mail";
import { appUrl } from "./ids";

export type Note = { title: string; body?: string; link?: string };

/** Creates in-app notifications and, when email is configured, an email too. Never throws: a failed notice must not undo the action that caused it. */
export async function notifyUsers(userIds: string[], n: Note) {
  try {
    const ids = [...new Set(userIds.map(String))];
    if (!ids.length) return;
    const { Notification, User } = await getDb();
    await Notification.insertMany(ids.map((user) => ({ user, title: n.title, body: n.body ?? "", link: n.link })));
    if (mailConfigured()) {
      const us = await User.find({ _id: { $in: ids }, active: true, email: { $exists: true, $ne: "" } }, { email: 1, name: 1 }).limit(50).lean<any[]>();
      const link = n.link ? `${appUrl()}${n.link}` : appUrl();
      await Promise.all(us.map((u) => sendMail({ to: u.email, subject: n.title, html: `<p>Hello ${u.name},</p><p>${n.body ?? ""}</p><p><a href="${link}">Open in the platform</a></p>` }).catch(() => false)));
    }
  } catch { /* swallow */ }
}

/** The administrators responsible for a parish: its own, its area's and its zone's. */
export async function adminsOf(o: { zone?: any; area?: any; parish?: any }): Promise<string[]> {
  const { User } = await getDb();
  const or: any[] = [];
  if (o.parish) or.push({ role: "parish_admin", parish: o.parish });
  if (o.area) or.push({ role: "area_admin", area: o.area });
  if (o.zone) or.push({ role: "zonal_admin", zone: o.zone });
  if (!or.length) return [];
  return (await User.find({ active: true, $or: or }, { _id: 1 }).lean<any[]>()).map((u) => String(u._id));
}

export async function financeTeam(): Promise<string[]> {
  const { User } = await getDb();
  return (await User.find({ active: true, role: { $in: ["finance_admin", "super_admin"] } }, { _id: 1 }).lean<any[]>()).map((u) => String(u._id));
}
