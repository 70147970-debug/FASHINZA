/**
 * Cross-site protection (docs/mern/api.md §1.6). Next.js server actions rejected cross-site posts; this
 * reproduces it for every state-changing /api request except the payment webhook.
 * A missing Origin header is allowed (as in Next.js).
 */
import { AppError } from "../lib/errors.js";

const SAFE = new Set(["GET", "HEAD", "OPTIONS"]);
const WEBHOOK = /^\/webhooks\/payments\/[^/]+\/?$/;

export function requestHost(req) {
  const forwarded = req.get("x-forwarded-host");
  return (forwarded ? forwarded.split(",")[0].trim() : req.get("host")) ?? "";
}

/** Mounted at /api, so req.path is relative to /api. */
export function sameOriginOnly(req, _res, next) {
  if (SAFE.has(req.method)) return next();
  if (req.method === "POST" && WEBHOOK.test(req.path)) return next();
  const origin = req.get("origin");
  if (origin === undefined) return next();
  let host;
  try {
    host = new URL(origin).host;
  } catch {
    host = null; // e.g. "null" from sandboxed frames
  }
  if (!host || host.toLowerCase() !== requestHost(req).toLowerCase()) {
    throw new AppError("Cross-site request rejected.", "FORBIDDEN");
  }
  next();
}
