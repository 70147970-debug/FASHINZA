/**
 * Form handling (port of formObject / parseForm / files from src/server/action.ts). See docs/mern/api.md §1.2.
 */
import { zodFieldErrors } from "@fashinza/shared/form-state.js";
import { multipartBody } from "../middleware/body.js";
import { AppError } from "./errors.js";

/**
 * Request body → plain object, like formObject():
 * - `arrayKeys` → always an array of non-blank strings (JSON: a single string becomes a one-element array);
 * - other keys → a string; a repeated key keeps its last value (JSON: values are taken as sent);
 * - keys starting with "$ACTION" are dropped; files are never part of the object.
 * @param {import("express").Request} req
 * @param {readonly string[]} [arrayKeys]
 * @returns {Record<string, unknown>}
 */
export function readForm(req, arrayKeys = []) {
  const body = req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body) ? req.body : {};
  const isJson = Boolean(req.is("application/json"));
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const [k, v] of Object.entries(body)) {
    if (k.startsWith("$ACTION") || arrayKeys.includes(k)) continue;
    if (isJson) {
      out[k] = v;
    } else if (Array.isArray(v)) {
      const strings = v.filter((x) => typeof x === "string");
      if (strings.length) out[k] = strings[strings.length - 1];
    } else if (typeof v === "string") {
      out[k] = v;
    }
  }
  for (const k of arrayKeys) {
    const v = body[k];
    const list = v == null ? [] : Array.isArray(v) ? v : [v];
    out[k] = list.filter((x) => typeof x === "string" && x.trim() !== "");
  }
  return out;
}

/**
 * Validates with a shared zod schema.
 * @template {import("zod").ZodTypeAny} S
 * @param {S} schema
 * @param {unknown} data
 * @returns {{ ok: true, data: import("zod").output<S> } | { ok: false, error: AppError }}
 */
export function parseForm(schema, data) {
  const parsed = schema.safeParse(data);
  if (parsed.success) return { ok: true, data: parsed.data };
  return { ok: false, error: new AppError("Please correct the highlighted fields.", "INVALID", zodFieldErrors(parsed.error)) };
}

/** parseForm that throws the INVALID error instead of returning it. */
export function validateForm(schema, data) {
  const result = parseForm(schema, data);
  if (!result.ok) throw result.error;
  return result.data;
}

/**
 * Multipart middleware for upload routes, e.g. `uploadFields({ file: 1 })`, `uploadFields({ photos: 20 })`.
 * The /api body parser already parses multipart bodies for every route, so this only parses when that has
 * not happened (e.g. a router mounted elsewhere). Per-field counts are enforced by the routes themselves
 * (today's actions report "Upload up to 10 photos per sample." etc.), so they are documentation here.
 * @param {Record<string, number>} spec
 */
export function uploadFields(spec = {}) {
  function uploadFieldsMiddleware(req, res, next) {
    if (req.multipartParsed || !req.is("multipart/form-data")) return next();
    multipartBody(req, res, next);
  }
  uploadFieldsMiddleware.fields = Object.freeze({ ...spec });
  return uploadFieldsMiddleware;
}

/**
 * Non-empty uploaded files of one field: [{ originalname, mimetype, size, buffer }].
 * Throws the deferred upload error (file over 10 MB, unreadable body) if parsing failed.
 * @param {import("express").Request} req
 * @param {string} field
 */
export function filesOf(req, field) {
  if (req.uploadError) throw req.uploadError;
  const files = Array.isArray(req.files) ? req.files.filter((f) => f.fieldname === field) : (req.files?.[field] ?? []);
  return files.filter((f) => f && f.size > 0);
}

/** Mutation success: `{ ok: true, message?, redirectTo?, … }`. */
export const ok = (res, body = {}) => res.json({ ok: true, ...body });

/** Express 5 forwards rejected promises already; kept for explicitness and Express 4-style handlers. */
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
