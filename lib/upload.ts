import crypto from "node:crypto";
import { ApiError } from "./errors";

export type FileKind = "png" | "jpeg" | "webp" | "gif" | "pdf";
const MIME: Record<FileKind, string> = { png: "image/png", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", pdf: "application/pdf" };

/** Identifies a file by its first bytes. The browser-supplied type and file extension are never trusted. */
export function sniff(b: Buffer): FileKind | null {
  if (b.length < 12) return null;
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP") return "webp";
  if (["GIF87a", "GIF89a"].includes(b.subarray(0, 6).toString("latin1"))) return "gif";
  if (b.subarray(0, 5).toString("latin1") === "%PDF-") return "pdf";
  return null;
}

/** Reads an uploaded form file and checks size and real type. Returns the bytes, the verified mime and a SHA-256. */
export async function readUpload(file: unknown, allow: FileKind[], maxBytes: number) {
  if (!(file instanceof File)) throw new ApiError(400, "Choose a file to upload.");
  if (file.size === 0) throw new ApiError(400, "That file is empty.");
  if (file.size > maxBytes) throw new ApiError(413, `That file is over ${Math.round(maxBytes / 1024 / 1024)} MB. Please use a smaller one.`);
  const data = Buffer.from(await file.arrayBuffer());
  const kind = sniff(data);
  if (!kind || !allow.includes(kind)) {
    const names = allow.map((k) => (k === "jpeg" ? "JPG" : k.toUpperCase())).join(", ");
    throw new ApiError(415, `That doesn't look like a valid ${names} file.`);
  }
  return { data, mime: MIME[kind], kind, hash: crypto.createHash("sha256").update(data).digest("hex"), name: file.name.replace(/[^\w.\- ()]/g, "_").slice(0, 120) };
}
