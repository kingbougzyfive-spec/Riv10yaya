import { getDb } from "./db";
import { dispatch } from "./notifier";

export type Note = { title: string; body?: string; link?: string; event?: string; dedupe?: string };

/** Tells people something through the central pipeline (in-app, then email and push as each person allows). Never throws. */
export async function notifyUsers(userIds: string[], n: Note) {
  await dispatch({ userIds, title: n.title, body: n.body, link: n.link, event: n.event, dedupe: n.dedupe, origin: "system" });
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
