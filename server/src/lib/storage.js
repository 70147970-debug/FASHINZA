/**
 * Private file storage (port of src/server/storage.ts). Files are written outside the web root (UPLOAD_DIR,
 * default <repo>/uploads) under random keys and are only ever served through GET /api/files/<key>, which
 * checks that the signed-in user may see the record that owns the file.
 *
 * `file` is a multer file object: { originalname, mimetype, size, buffer }.
 */
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { UPLOAD_LIMITS } from "@fashinza/shared/constants.js";
import { config } from "../config.js";
import { invalid } from "./errors.js";

const EXT = { "application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
export const FILE_KEY_PATTERN = /^[a-z0-9-]+\/[a-f0-9]{32}\.(pdf|png|jpg|webp)$/;

export function uploadRoot() {
  return config.uploadDir;
}

/** Checks the first bytes so a renamed file cannot pass the MIME check. */
export function sniff(buf) {
  if (buf.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  return null;
}

function isFile(file) {
  return Boolean(file) && typeof file === "object" && Buffer.isBuffer(file.buffer);
}

/** @param {any} file @param {{ imagesOnly?: boolean }} [opts] */
export function validateUpload(file, opts = {}) {
  if (!isFile(file) || file.size === 0 || file.buffer.length === 0) throw invalid("Choose a file to upload.");
  const size = file.size ?? file.buffer.length;
  if (size > UPLOAD_LIMITS.maxBytes) throw invalid(`Files must be ${UPLOAD_LIMITS.maxBytes / 1024 / 1024} MB or smaller.`);
  const allowed = opts.imagesOnly ? UPLOAD_LIMITS.allowedMime.filter((m) => m.startsWith("image/")) : UPLOAD_LIMITS.allowedMime;
  if (!allowed.includes(file.mimetype)) throw invalid(opts.imagesOnly ? "Upload PNG, JPEG or WebP images." : "Upload a PDF, PNG, JPEG or WebP file.");
}

/**
 * Validates, sniffs and writes the file. Returns the metadata stored on the owning record.
 * @param {any} file
 * @param {string} folder "projects" | "factory-docs" | "evidence" | "samples" | "qc"
 * @param {{ imagesOnly?: boolean }} [opts]
 * @returns {Promise<{ fileKey: string, fileName: string, mimeType: string, size: number }>}
 */
export async function saveUpload(file, folder, opts = {}) {
  validateUpload(file, opts);
  const buf = file.buffer;
  const detected = sniff(buf);
  if (!detected || detected !== file.mimetype) throw invalid("The file content does not match its type. Upload a genuine PDF or image.");
  const fileKey = `${folder}/${randomBytes(16).toString("hex")}.${EXT[detected]}`;
  const full = resolveKey(fileKey);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, buf, { flag: "wx" });
  const fileName = path.basename(String(file.originalname ?? "")).replace(/[^\w.\- ()]/g, "_").slice(0, 150) || `file.${EXT[detected]}`;
  return { fileKey, fileName, mimeType: detected, size: buf.length };
}

export async function readStoredFile(fileKey) {
  return readFile(resolveKey(fileKey));
}

export async function deleteStoredFile(fileKey) {
  await rm(resolveKey(fileKey), { force: true });
}

/** Validates the key format ("Invalid file key.") and returns the absolute path. */
export function resolveKey(fileKey) {
  if (typeof fileKey !== "string" || !FILE_KEY_PATTERN.test(fileKey)) throw invalid("Invalid file key.");
  return path.join(uploadRoot(), fileKey);
}
