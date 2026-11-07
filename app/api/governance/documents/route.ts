import crypto from "node:crypto";
import mongoose from "mongoose";
import { handle, audit } from "@/lib/api";
import { ApiError, requireApiUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { PERMS } from "@/lib/rbac";
import { listFilter, loadGov, names, orgOf, orgOut, resolveOrg } from "@/lib/gov-server";
import { canManage, DOC_MAX, DOC_TYPES, LEVELS } from "@/lib/governance";

export const dynamic = "force-dynamic";

/** The file really is what its type claims (the browser-supplied type alone is not trusted). */
function signatureOk(mime: string, b: Buffer) {
  const h = (x: string) => b.subarray(0, x.length / 2).toString("hex");
  if (mime === "application/pdf") return b.subarray(0, 4).toString() === "%PDF";
  if (mime === "image/png") return h("89504e47") === "89504e47";
  if (mime === "image/jpeg") return h("ffd8ff").startsWith("ffd8ff");
  if (mime.includes("openxmlformats")) return b.subarray(0, 2).toString() === "PK";
  if (mime === "application/msword" || mime === "application/vnd.ms-excel") return h("d0cf11e0a1b11ae1") === "d0cf11e0a1b11ae1";
  if (mime === "text/plain") return !b.subarray(0, 2000).includes(0);
  return false;
}

export const GET = handle(async (req) => {
  const user = await requireApiUser(PERMS.governance);
  const q = new URL(req.url).searchParams;
  const f = listFilter(user, q);
  for (const k of ["committee", "department", "meeting"]) if (q.get(k) && mongoose.isValidObjectId(q.get(k))) f[k] = q.get(k);
  if (q.get("category")) f.category = q.get("category");
  const { GovDocument } = await getDb();
  const [rows, n] = await Promise.all([GovDocument.find(f).sort({ createdAt: -1 }).limit(300).lean<any[]>(), names()]);
  return { rows: rows.map((d) => ({ id: String(d._id), title: d.title, description: d.description ?? "", category: d.category, ...orgOut(d, n), fileName: d.fileName, mime: d.mime, size: d.size, mediaId: String(d.media), uploadedByName: d.uploadedByName, at: d.createdAt, committeeId: d.committee ? String(d.committee) : null, departmentId: d.department ? String(d.department) : null, meetingId: d.meeting ? String(d.meeting) : null, canManage: canManage(user, orgOf(d)) })) };
});

export const POST = handle(async (req) => {
  const user = await requireApiUser(PERMS.governanceManage);
  const fd = await req.formData();
  const file = fd.get("file");
  if (!(file instanceof File)) throw new ApiError(400, "Choose a file to upload.");
  const mime = file.type;
  if (!DOC_TYPES[mime]) throw new ApiError(415, "Upload a PDF, Word, Excel, PowerPoint, text, PNG or JPG file.");
  if (file.size > DOC_MAX) throw new ApiError(413, "That file is over 6 MB.");
  const str = (k: string) => String(fd.get(k) ?? "").trim();
  const title = str("title") || file.name.replace(/\.[^.]+$/, "");
  if (title.length < 2) throw new ApiError(422, "Give the document a title.");
  const category = ["minutes", "policy", "report", "letter", "other"].includes(str("category")) ? str("category") : "other";

  // The document belongs to its committee, meeting or department when given, else to the level chosen.
  let org: any;
  const link: any = {};
  for (const [k, model] of [["committee", "Committee"], ["meeting", "Meeting"], ["department", "Department"]] as const) {
    if (str(k)) { org = orgOf(await loadGov(model, str(k), user, true)); link[k] = str(k); break; }
  }
  if (!org) { const level = str("level"); if (!(LEVELS as readonly string[]).includes(level)) throw new ApiError(400, "Choose the level this document belongs to."); org = await resolveOrg(user, { level: level as any, zone: str("zone"), area: str("area"), parish: str("parish") }); }
  org = { level: org.level, zone: org.zone || undefined, area: org.area || undefined, parish: org.parish || undefined };

  const data = Buffer.from(await file.arrayBuffer());
  if (!signatureOk(mime, data)) throw new ApiError(415, "That file doesn't look like a real " + DOC_TYPES[mime].toUpperCase() + " file.");
  const { Media, GovDocument } = await getDb();
  const media = await Media.create({ name: file.name.slice(0, 120), mime, size: file.size, data, hash: crypto.createHash("sha256").update(data).digest("hex"), uploadedBy: user.id, private: true, document: true, docOrg: org });
  const d = await GovDocument.create({ ...org, ...link, title, description: str("description").slice(0, 1000), category, media: media._id, fileName: media.name, mime, size: file.size, uploadedBy: user.id, uploadedByName: user.name });
  await audit(user, "document.upload", title, { level: org.level }, req);
  return { id: String(d._id) };
});
