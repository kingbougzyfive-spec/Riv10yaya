import { getDb } from "./db";
import { dispatch } from "./notifier";

/** A published public announcement: in-app for every account, push for every device (including visitors), no email. */
export async function announceEveryone(title: string, body: string, sender: { id: string; name: string }) {
  const { User } = await getDb();
  const ids = (await User.find({ active: true }, { _id: 1 }).limit(5000).lean<any[]>()).map((u) => String(u._id));
  return dispatch({ event: "announcement", title, body: body.slice(0, 300), link: "/announcements", userIds: ids, channels: { email: false, push: true }, origin: "manual", sender, audience: { type: "everyone", labels: ["Public announcement"] }, anonymousPush: true });
}
