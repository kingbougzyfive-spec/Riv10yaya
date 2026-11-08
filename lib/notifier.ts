/**
 * The one notification pipeline. Everything that tells a person something goes through dispatch():
 *   1. In-app notice (always created, cannot be switched off), so nothing is ever lost.
 *   2. Email, if the person allows it for this category and mail is configured.
 *   3. Web Push to their devices, if they allow it, have a device, and push is configured.
 * Each outside channel is independent: if one fails the others still go, the failure is written to the delivery log,
 * and an administrator can retry. dispatch() never throws, so a failed notice can't undo the action that caused it.
 */
import mongoose from "mongoose";
import { getDb } from "./db";
import { appUrl } from "./ids";
import { mailConfigured, sendMailResult } from "./mail";
import { categoryOf, channelOn, type Category } from "./notify-events";
import { pushConfigured, pushToSubs } from "./push";

export type External = { email: string; name?: string };
export type DispatchInput = {
  event?: string; category?: Category;
  title: string; body?: string; link?: string;
  userIds?: string[]; external?: External[];
  /** Which outside channels the sender wants. Recipients' own preferences still apply. Defaults to both. */
  channels?: { email?: boolean; push?: boolean };
  origin?: "manual" | "system";
  sender?: { id: string; name: string };
  audience?: { type: string; labels: string[] };
  /** A reminder key: a person who already has a notice with this key is skipped. */
  dedupe?: string;
  /** People who must not be emailed by this send (e.g. under-18s in a bulk message). */
  noEmail?: string[];
  /** Also push to visitors who subscribed without signing in (public announcements only). */
  anonymousPush?: boolean;
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const emailHtml = (name: string | undefined, title: string, body: string | undefined, link: string | undefined) =>
  `<div style="font-family:Arial,sans-serif;max-width:560px"><p>Hello${name ? ` ${esc(name.split(" ")[0])}` : ""},</p><h3 style="margin:0 0 8px">${esc(title)}</h3>${body ? `<p style="white-space:pre-wrap">${esc(body)}</p>` : ""}${link ? `<p><a href="${esc(link.startsWith("http") ? link : appUrl() + link)}">Open in the platform</a></p>` : ""}<hr style="border:none;border-top:1px solid #ddd"/><p style="font-size:12px;color:#777">You can choose which messages you receive in your notification settings.</p></div>`;

async function pool<T>(items: T[], size: number, fn: (x: T) => Promise<void>) {
  for (let i = 0; i < items.length; i += size) await Promise.all(items.slice(i, i + size).map(fn));
}

export type DispatchResult = { logId: string | null; recipients: number; totals: Record<string, number> };

export async function dispatch(input: DispatchInput): Promise<DispatchResult> {
  const empty: DispatchResult = { logId: null, recipients: 0, totals: {} };
  try {
    const category = input.category ?? categoryOf(input.event);
    const want = { email: input.channels?.email !== false, push: input.channels?.push !== false };
    const ids = [...new Set((input.userIds ?? []).map(String).filter((x) => mongoose.isValidObjectId(x)))];
    const { User, Notification, NotificationLog, PushSub } = await getDb();
    let users = ids.length ? await User.find({ _id: { $in: ids }, active: true }, { name: 1, email: 1, prefs: 1 }).lean<any[]>() : [];
    if (input.dedupe) {
      const done = new Set((await Notification.find({ dedupe: input.dedupe, user: { $in: users.map((u) => u._id) } }, { user: 1 }).lean<any[]>()).map((n) => String(n.user)));
      users = users.filter((u) => !done.has(String(u._id)));
    }
    const external = [...new Map((input.external ?? []).filter((e) => e.email).map((e) => [e.email.toLowerCase(), e])).values()];
    if (!users.length && !external.length && !input.anonymousPush) return empty;

    const t = { recipients: users.length + external.length, inApp: 0, emailSent: 0, emailFailed: 0, emailSkipped: 0, pushSent: 0, pushFailed: 0, pushNoDevice: 0, pushSkipped: 0, externalSent: 0, externalFailed: 0 };
    const failures: { channel: string; user?: any; name?: string; to?: string; error: string }[] = [];
    const log = await NotificationLog.create({ origin: input.origin ?? "system", event: input.event, category, title: input.title.slice(0, 200), body: input.body?.slice(0, 2000), link: input.link, audience: input.audience, channels: want, sentBy: input.sender?.id, sentByName: input.sender?.name, totals: t, status: "done" });

    // 1. In-app: always.
    const delivery = new Map<string, { email: string; push: string }>();
    for (const u of users) delivery.set(String(u._id), { email: "none", push: "none" });
    const docs = await Notification.insertMany(users.map((u) => ({ user: u._id, title: input.title.slice(0, 200), body: input.body ?? "", link: input.link, event: input.event, category, batch: log._id, dedupe: input.dedupe, delivery: {} })), { ordered: false }).catch(() => []);
    t.inApp = docs.length;

    // 2. Email.
    const mailOk = mailConfigured();
    const noEmail = new Set((input.noEmail ?? []).map(String));
    await pool(users, 8, async (u) => {
      const d = delivery.get(String(u._id))!;
      if (!want.email || !u.email || noEmail.has(String(u._id)) || !channelOn(u.prefs, "email", category)) { d.email = "off"; t.emailSkipped++; return; }
      if (!mailOk) { d.email = "skipped"; t.emailSkipped++; return; }
      const r = await sendMailResult({ to: u.email, subject: input.title.slice(0, 150), html: emailHtml(u.name, input.title, input.body, input.link) });
      if (r.ok) { d.email = "sent"; t.emailSent++; } else { d.email = "failed"; t.emailFailed++; if (failures.length < 200) failures.push({ channel: "email", user: u._id, name: u.name, to: u.email, error: r.error ?? "Failed" }); }
    });
    // Recipients with no account (e.g. event registrants): email only.
    await pool(external, 8, async (e) => {
      if (!want.email || !mailOk) { t.emailSkipped++; return; }
      const r = await sendMailResult({ to: e.email, subject: input.title.slice(0, 150), html: emailHtml(e.name, input.title, input.body, input.link) });
      if (r.ok) t.externalSent++; else { t.externalFailed++; if (failures.length < 200) failures.push({ channel: "email", name: e.name, to: e.email, error: r.error ?? "Failed" }); }
    });

    // 3. Push.
    const pushUrl = input.link || "/";
    if (pushConfigured() && users.length) {
      const subs = await PushSub.find({ user: { $in: users.map((u) => u._id) } }).limit(5000).lean<any[]>();
      const by = new Map<string, any[]>();
      for (const s of subs) by.set(String(s.user), [...(by.get(String(s.user)) ?? []), s]);
      const targets = users.filter((u) => want.push && channelOn(u.prefs, "push", category));
      const subList = targets.flatMap((u) => by.get(String(u._id)) ?? []);
      const res = await pushToSubs(subList, { title: input.title, body: input.body, url: pushUrl });
      for (const u of users) {
        const d = delivery.get(String(u._id))!;
        if (!want.push || !channelOn(u.prefs, "push", category)) { d.push = "off"; t.pushSkipped++; continue; }
        const mine = by.get(String(u._id)) ?? [];
        if (!mine.length) { d.push = "none"; t.pushNoDevice++; continue; }
        const results = mine.map((s) => res.get(s.endpoint));
        if (results.some((r) => r?.ok)) { d.push = "sent"; t.pushSent++; }
        else { d.push = "failed"; t.pushFailed++; if (failures.length < 200) failures.push({ channel: "push", user: u._id, name: u.name, error: results.find((r) => r?.error)?.error ?? "Failed" }); }
      }
    } else for (const u of users) { const d = delivery.get(String(u._id))!; d.push = pushConfigured() ? "none" : "skipped"; if (!pushConfigured()) t.pushSkipped++; }

    if (input.anonymousPush && pushConfigured() && want.push) {
      const anon = await PushSub.find({ $or: [{ user: { $exists: false } }, { user: null }] }).limit(2000).lean<any[]>();
      const res = await pushToSubs(anon, { title: input.title, body: input.body, url: pushUrl });
      for (const r of res.values()) { if (r.ok) t.pushSent++; else t.pushFailed++; }
      t.recipients += anon.length;
    }

    if (docs.length) await Notification.bulkWrite(docs.map((n: any) => ({ updateOne: { filter: { _id: n._id }, update: { $set: { delivery: delivery.get(String(n.user)) } } } }))).catch(() => {});
    const failed = t.emailFailed + t.pushFailed + t.externalFailed;
    await NotificationLog.updateOne({ _id: log._id }, { $set: { totals: t, failures, status: failed ? (t.inApp || t.emailSent || t.pushSent || t.externalSent ? "partial" : "failed") : "done" } });
    return { logId: String(log._id), recipients: t.recipients, totals: t };
  } catch (e) {
    console.error("dispatch failed", e);
    return empty;
  }
}
