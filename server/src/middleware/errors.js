/**
 * Error responses (docs/mern/api.md §1.4): `{ error: { code, message, fieldErrors? } }`.
 */
import mongoose from "mongoose";
import { isDatabaseUnavailable } from "../db.js";
import { AppError, INTERNAL_MESSAGES, isAppError, notFound, STATUS } from "../lib/errors.js";

/** 404 for unknown /api routes. */
export function notFoundApi(_req, res) {
  res.status(404).json({ error: { code: "NOT_FOUND", message: "Not found." } });
}

/**
 * Marks a route whose unexpected failures use today's route-handler message ("Something went wrong. Please
 * try again.") instead of the server-action message. GET requests always use it.
 */
export function routeHandlerErrors(_req, res, next) {
  res.locals.internalMessage = INTERNAL_MESSAGES.route;
  next();
}

/** Converts known non-AppError failures into AppErrors; returns null for unexpected ones. */
export function toAppError(err) {
  if (isAppError(err)) return err;
  if (err instanceof mongoose.Error.CastError) return notFound();
  if (err?.type === "entity.too.large") return new AppError("Payload too large.", "PAYLOAD_TOO_LARGE");
  if (err?.type === "entity.parse.failed") return new AppError("The request body could not be read.", "INVALID");
  return null;
}

export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  const appError = toAppError(err);
  if (appError) {
    const body = { code: appError.code, message: appError.message };
    if (appError.fieldErrors) body.fieldErrors = appError.fieldErrors;
    return res.status(STATUS[appError.code] ?? 500).json({ error: body });
  }
  const message = res.locals.internalMessage ?? (req.method === "GET" || req.method === "HEAD" ? INTERNAL_MESSAGES.route : INTERNAL_MESSAGES.mutation);
  if (isDatabaseUnavailable(err)) {
    // MongoDB is down or not reachable yet. Same user-facing text as any unexpected failure today (the Next app
    // showed it when PostgreSQL was down), but a 503 so clients and probes can tell it apart.
    console.error(`[api] database unavailable: ${req.method} ${req.path} (${err?.message ?? err})`);
    return res.status(503).json({ error: { code: "DATABASE_UNAVAILABLE", message } });
  }
  console.error("[api] unexpected error", err);
  res.status(500).json({ error: { code: "INTERNAL", message } });
}
