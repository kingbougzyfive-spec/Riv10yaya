import { getDb } from "./db";
import { appUrl } from "./ids";

/** Web Push needs a VAPID key pair (generate with: npx web-push generate-vapid-keys). */
export const pushConfigured = () => !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
export const pushPublicKey = () => process.env.VAPID_PUBLIC_KEY || "";

export type PushPayload = { title: string; body?: string; url?: string };

/** Sends to every subscribed device. Never throws: a failed push must not break the action that triggered it. */
export async function sendPush(p: PushPayload): Promise<{ sent: number; removed: number; failed: number }> {
  const out = { sent: 0, removed: 0, failed: 0 };
  if (!pushConfigured()) return out;
  try {
    const webpush = (await import("web-push")).default;
    const subject = process.env.VAPID_SUBJECT || (process.env.MAIL_FROM?.match(/<(.+)>/)?.[1] ?? process.env.MAIL_FROM) || appUrl();
    webpush.setVapidDetails(/^(mailto:|https:)/.test(subject) ? subject : subject.includes("@") ? `mailto:${subject}` : subject, process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
    const { PushSub } = await getDb();
    const subs = await PushSub.find().limit(2000).lean<any[]>();
    const payload = JSON.stringify({ title: p.title.slice(0, 120), body: (p.body || "").slice(0, 200), url: p.url || "/announcements" });
    const dead: string[] = [];
    for (let i = 0; i < subs.length; i += 25) {
      await Promise.all(subs.slice(i, i + 25).map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60 * 60 * 24 });
          out.sent++;
        } catch (e: any) {
          if (e?.statusCode === 404 || e?.statusCode === 410) dead.push(s.endpoint); else out.failed++;
        }
      }));
    }
    if (dead.length) { await PushSub.deleteMany({ endpoint: { $in: dead } }); out.removed = dead.length; }
  } catch { out.failed++; }
  return out;
}

type Sub = { endpoint: string; p256dh: string; auth: string };
/** Sends one payload to specific devices. Dead subscriptions are removed. Returns per-endpoint results. Never throws. */
export async function pushToSubs(subs: Sub[], p: PushPayload): Promise<Map<string, { ok: boolean; error?: string }>> {
  const out = new Map<string, { ok: boolean; error?: string }>();
  if (!pushConfigured() || !subs.length) return out;
  try {
    const webpush = (await import("web-push")).default;
    const subject = process.env.VAPID_SUBJECT || (process.env.MAIL_FROM?.match(/<(.+)>/)?.[1] ?? process.env.MAIL_FROM) || appUrl();
    webpush.setVapidDetails(/^(mailto:|https:)/.test(subject) ? subject : subject.includes("@") ? `mailto:${subject}` : subject, process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
    const payload = JSON.stringify({ title: p.title.slice(0, 120), body: (p.body || "").slice(0, 200), url: p.url || "/" });
    const dead: string[] = [];
    for (let i = 0; i < subs.length; i += 25) {
      await Promise.all(subs.slice(i, i + 25).map(async (s) => {
        try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60 * 60 * 24 }); out.set(s.endpoint, { ok: true }); }
        catch (e: any) { if (e?.statusCode === 404 || e?.statusCode === 410) { dead.push(s.endpoint); out.set(s.endpoint, { ok: false, error: "Device no longer subscribed" }); } else out.set(s.endpoint, { ok: false, error: String(e?.body || e?.message || "Push failed").slice(0, 160) }); }
      }));
    }
    if (dead.length) { const { PushSub } = await getDb(); await PushSub.deleteMany({ endpoint: { $in: dead } }); }
  } catch (e: any) { for (const s of subs) if (!out.has(s.endpoint)) out.set(s.endpoint, { ok: false, error: String(e?.message || "Push failed").slice(0, 160) }); }
  return out;
}
