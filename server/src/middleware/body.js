/**
 * Request body parsing for /api (docs/mern/api.md §1.2): JSON, urlencoded and multipart/form-data.
 *
 * Multipart bodies are parsed once for every route (memory storage) so that plain FormData posts work on
 * every mutation. Upload problems (file over 10 MB, malformed body) do not fail the request here: they are
 * stored on `req.uploadError` and thrown by `filesOf()` when the route reads its files. This keeps today's
 * order of checks (authentication and rate limits before upload validation).
 */
import express from "express";
import multer from "multer";
import { UPLOAD_LIMITS } from "@fashinza/shared/constants.js";
import { AppError, invalid } from "../lib/errors.js";

/** Next.js server actions accepted bodies up to 25 MB (next.config.ts serverActions.bodySizeLimit). */
export const MAX_MULTIPART_BYTES = 25 * 1024 * 1024;
/** Upper bound on files per request (largest per-endpoint limit is 20 QC photos; extra files must still reach the route's own "up to n" checks). */
export const MAX_FILES = 40;

export const tooLargeError = () => invalid(`Files must be ${UPLOAD_LIMITS.maxBytes / 1024 / 1024} MB or smaller.`);

const parser = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: UPLOAD_LIMITS.maxBytes, files: MAX_FILES, fields: 1000, fieldSize: 2 * 1024 * 1024, parts: 1100 },
  defParamCharset: "utf8",
}).any();

/** Maps multer / busboy failures to the user-facing upload messages. */
export function uploadErrorFrom(err) {
  if (err instanceof AppError) return err;
  if (err?.code === "LIMIT_FILE_SIZE") return tooLargeError();
  if (err?.code === "LIMIT_FILE_COUNT") return invalid("Too many files. Upload fewer files at once.");
  return invalid("The upload could not be read. Please try again.");
}

export function multipartBody(req, res, next) {
  if (!req.is("multipart/form-data")) return next();
  if (req.multipartParsed) return next();
  req.multipartParsed = true;
  const length = Number(req.get("content-length") ?? 0);
  if (length > MAX_MULTIPART_BYTES) {
    req.body = {};
    req.files = [];
    req.uploadError = tooLargeError();
    return next();
  }
  parser(req, res, (err) => {
    if (err) {
      req.body ??= {};
      req.files ??= [];
      req.uploadError = uploadErrorFrom(err);
    }
    next();
  });
}

/** JSON (≤ 2 MB), urlencoded and multipart parsers, in that order. */
export const bodyParsers = [express.json({ limit: "2mb" }), express.urlencoded({ extended: false, limit: "2mb" }), multipartBody];
