import { z } from "zod";
import { audit, handle } from "@/lib/api";
import { ApiError } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { STATE_MESSAGE, findLink, identityOfLink, openSession, requireOpenLink, stateOf, submitterFor, tryPassword } from "@/lib/fill-links";
import { MONTHS } from "@/lib/money";
import { notifyUsers } from "@/lib/notify";
import { HOUR, MIN, clientIp, rateLimit } from "@/lib/ratelimit";
import { buildReportContext } from "@/lib/report-context";
import { reportDraftSchema, reportSubmitSchema, saveReportDraft, submitReport } from "@/lib/report-submit";
import { remittanceSubmitSchema, submitRemittance } from "@/lib/remittance-submit";
import { readUpload } from "@/lib/upload";
import { recordSchema, saveEventRecord, unitOf } from "@/lib/event-records";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
const MAX_FILE = 4 * 1024 * 1024;
type Ctx = { params: Promise<{ token: string; action: string }> };
const unlockSchema = z.object({ password: z.string().min(1).max(60), name: z.string().trim().min(2, "Please type your name").max(80), phone: z.string().trim().regex(/^(\+?\d[\d\s-]{7,16})$/, "Enter a valid phone number") });

/** What the person sees before they enter the password: only what the form is for. Nothing from the parish's records. */
async function info(token: string) {
  const link: any = await findLink(token);
  if (!link) return { state: "invalid" as const };
  const st = stateOf(link);
  const id = await identityOfLink(link);
  const { EventForm } = await getDb();
  const ev: any = link.eventForm ? await EventForm.findById(link.eventForm, { title: 1 }).lean() : null;
  const unit = id.names.parish ?? id.names.area ?? id.names.zone ?? "The whole province";
  return {
    state: st, message: st === "ok" ? "" : STATE_MESSAGE[st], purpose: link.purpose as "monthly" | "event", unit, unitType: link.unitType,
    title: link.purpose === "monthly" ? (link.unitType === "parish" ? "Monthly report and remittance" : "Monthly report") : ev?.title ?? "Event record",
    period: link.purpose === "monthly" ? `${MONTHS[link.month - 1]} ${link.year}` : "", month: link.month ?? null, year: link.year ?? null, madeBy: link.createdByName, expiresAt: link.expiresAt,
  };
}

export const GET = handle(async (req, ctx: Ctx) => {
  const { token, action } = await ctx.params;
  await rateLimit(`fillget:${clientIp(req)}`, 240, 10 * MIN, "Too many requests. Please wait a little.");
  if (action === "info") return info(token);
  const { link, who } = await requireOpenLink(token);
  if (action === "context") {
    if (link.purpose !== "monthly") throw new ApiError(400, "This link is not for the monthly form.");
    return buildReportContext(await identityOfLink(link), { fullName: who.name, phone: who.phone }, link.month, link.year);
  }
  if (action === "event") {
    if (link.purpose !== "event") throw new ApiError(400, "This link is not for an event record.");
    const { EventForm, EventRecord } = await getDb();
    const form: any = await EventForm.findById(link.eventForm).lean();
    if (!form) throw new ApiError(404, "This event form no longer exists.");
    const unit = await unitOf(link.unitType, link.unitType === "province" ? undefined : String(link[link.unitType]));
    const rec: any = await EventRecord.findOne({ form: form._id, unitKey: unit.key }).lean();
    return {
      form: { id: String(form._id), title: form.title, description: form.description ?? "", eventDate: form.eventDate, endDate: form.endDate ?? null, venue: form.venue ?? "", level: form.level, collectOffering: form.collectOffering !== false, customFields: form.customFields ?? [], status: form.status },
      unit: { type: unit.type, name: unit.name },
      record: rec ? { males: rec.males, females: rec.females, total: rec.total, offeringKobo: rec.offeringKobo ?? null, extras: rec.extras ?? {}, notes: rec.notes ?? "", updatedAt: rec.updatedAt } : null,
    };
  }
  throw new ApiError(404, "Not found");
});

export const POST = handle(async (req, ctx: Ctx) => {
  const { token, action } = await ctx.params;
  const ip = clientIp(req);

  if (action === "unlock") {
    await rateLimit(`fillunlock:${ip}`, 25, 15 * MIN, "Too many tries from this device. Please wait 15 minutes.");
    const i = unlockSchema.parse(await req.json());
    const link: any = await findLink(token);
    if (!link) throw new ApiError(404, "This link isn't valid.");
    const st = stateOf(link);
    if (st === "revoked" || st === "expired") throw new ApiError(410, STATE_MESSAGE[st]);
    const ok = await tryPassword(link, i.password);
    if (!ok) {
      await audit(null, "filllink.password_failed", link.label || String(link._id), { entity: "filllink", entityId: String(link._id), ip }, req);
      throw new ApiError(401, stateOf(link) === "locked" ? STATE_MESSAGE.locked : "That password isn't right. Check it with the person who sent you the link.");
    }
    link.opens = (link.opens ?? 0) + 1; link.lastOpenedAt = new Date(); link.lastFilledBy = { name: i.name, phone: i.phone }; await link.save();
    await openSession(link, { name: i.name, phone: i.phone });
    await audit(null, "filllink.open", `${i.name} (${i.phone})`, { entity: "filllink", entityId: String(link._id) }, req);
    return { ok: true };
  }

  const { link, who } = await requireOpenLink(token);
  await rateLimit(`fillpost:${link._id}`, 120, HOUR, "That's a lot of activity on this link. Please wait a little.");
  const submitter = submitterFor(link, who);

  if (action === "evidence") {
    if (link.purpose !== "monthly" || link.unitType !== "parish") throw new ApiError(400, "Payment evidence is only for a parish remittance.");
    const up = await readUpload((await req.formData()).get("file"), ["png", "jpeg", "webp", "pdf"], MAX_FILE);
    const { Media } = await getDb();
    const m = await Media.create({ name: up.name, mime: up.mime, size: up.data.length, data: up.data, hash: up.hash, uploadedBy: link.createdBy, private: true, parish: link.parish });
    await audit(submitter.audit, "evidence.upload", up.name, { entity: "media", entityId: String(m._id), after: { sha256: up.hash, bytes: up.data.length, type: up.mime, parish: String(link.parish), viaLink: true } }, req);
    return { id: String(m._id), name: m.name };
  }

  if (action === "remittance") {
    if (link.purpose !== "monthly" || link.unitType !== "parish") throw new ApiError(400, "The remittance is only for a parish link.");
    const i = remittanceSubmitSchema.parse({ ...(await req.json()), month: link.month, year: link.year }); // the period is fixed by the link
    const r = await submitRemittance(submitter, await identityOfLink(link), i, req);
    link.remittanceAt = new Date(); await link.save();
    await notifyUsers([String(link.createdBy)], { title: `Remittance submitted through your link: ${link.label || "fill-in link"}`, body: `${who.name} (${who.phone}) submitted it. It is now with finance.`, link: "/admin/links" });
    return r;
  }

  if (action === "report") {
    if (link.purpose !== "monthly") throw new ApiError(400, "This link is not for the monthly form.");
    const body = reportSubmitSchema.parse({ ...(await req.json()), month: link.month, year: link.year });
    const r = await submitReport(submitter, await identityOfLink(link), body, req);
    link.reportAt = new Date(); await link.save();
    await notifyUsers([String(link.createdBy)], { title: `Monthly report submitted through your link: ${link.label || "fill-in link"}`, body: `${who.name} (${who.phone}) submitted it.`, link: "/admin/links" });
    return r;
  }
  if (action === "event") {
    if (link.purpose !== "event") throw new ApiError(400, "This link is not for an event record.");
    const { EventForm } = await getDb();
    const form: any = await EventForm.findById(link.eventForm).lean();
    if (!form) throw new ApiError(404, "This event form no longer exists.");
    const unit = await unitOf(link.unitType, link.unitType === "province" ? undefined : String(link[link.unitType]));
    const input = recordSchema(form).parse(await req.json());
    const r = await saveEventRecord({ actor: submitter, form, unit, input, via: "link", filledBy: who, req });
    link.recordAt = new Date(); await link.save();
    await notifyUsers([String(link.createdBy)], { title: `Event record submitted through your link: ${form.title}`, body: `${who.name} (${who.phone}) recorded ${r.total} (${r.males} men, ${r.females} women) for ${unit.name}.`, link: "/admin/event-records" });
    return r;
  }
  throw new ApiError(404, "Not found");
});

export const PUT = handle(async (req, ctx: Ctx) => {
  const { token, action } = await ctx.params;
  const { link, who } = await requireOpenLink(token);
  if (action === "report") {
    if (link.purpose !== "monthly") throw new ApiError(400, "This link is not for the monthly form.");
    const body = reportDraftSchema.parse({ ...(await req.json()), month: link.month, year: link.year });
    return saveReportDraft(submitterFor(link, who), await identityOfLink(link), body);
  }
  throw new ApiError(404, "Not found");
});
