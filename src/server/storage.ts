import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { UPLOAD_LIMITS } from "@/lib/constants";
import { invalid } from "./errors";

/**
 * Private file storage. Files are written outside the public web root (UPLOAD_DIR, default
 * ./uploads) under random keys and are only ever served through /api/files/[key], which
 * checks that the signed-in user may see the record that owns the file.
 *
 * To move to S3-compatible storage, implement the same three functions with an S3 client.
 */
// The ignore comments stop the bundler's file tracing from treating this runtime directory as a build input
// (otherwise the whole project, private uploads included, is copied into the standalone server bundle).
const ROOT = path.resolve(/*turbopackIgnore: true*/ process.env.UPLOAD_DIR ?? "uploads");

const EXT: Record<string, string> = { "application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

/** Check the first bytes so a renamed file cannot pass the MIME check. */
function sniff(buf: Buffer): string | null {
  if (buf.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  return null;
}

export type StoredFile = { fileKey: string; fileName: string; mimeType: string; size: number };

export function validateUpload(file: File, opts: { imagesOnly?: boolean } = {}) {
  if (!(file instanceof File) || file.size === 0) throw invalid("Choose a file to upload.");
  if (file.size > UPLOAD_LIMITS.maxBytes) throw invalid(`Files must be ${UPLOAD_LIMITS.maxBytes / 1024 / 1024} MB or smaller.`);
  const allowed = opts.imagesOnly ? UPLOAD_LIMITS.allowedMime.filter((m) => m.startsWith("image/")) : UPLOAD_LIMITS.allowedMime;
  if (!allowed.includes(file.type)) throw invalid(opts.imagesOnly ? "Upload PNG, JPEG or WebP images." : "Upload a PDF, PNG, JPEG or WebP file.");
}

export async function saveUpload(file: File, folder: string, opts: { imagesOnly?: boolean } = {}): Promise<StoredFile> {
  validateUpload(file, opts);
  const buf = Buffer.from(await file.arrayBuffer());
  const detected = sniff(buf);
  if (!detected || detected !== file.type) throw invalid("The file content does not match its type. Upload a genuine PDF or image.");
  const fileKey = `${folder}/${randomBytes(16).toString("hex")}.${EXT[detected]}`;
  const full = resolveKey(fileKey);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, buf, { flag: "wx" });
  const fileName = path.basename(file.name).replace(/[^\w.\- ()]/g, "_").slice(0, 150) || `file.${EXT[detected]}`;
  return { fileKey, fileName, mimeType: detected, size: buf.length };
}

export async function readStoredFile(fileKey: string) {
  return readFile(resolveKey(fileKey));
}

export async function deleteStoredFile(fileKey: string) {
  await rm(resolveKey(fileKey), { force: true });
}

function resolveKey(fileKey: string) {
  if (!/^[a-z0-9-]+\/[a-f0-9]{32}\.(pdf|png|jpg|webp)$/.test(fileKey)) throw invalid("Invalid file key.");
  return path.join(/*turbopackIgnore: true*/ ROOT, fileKey);
}
