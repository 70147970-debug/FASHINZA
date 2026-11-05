/**
 * Rate limits (docs/mern/api.md §1.7) on top of the in-memory fixed window from @fashinza/shared.
 * RATE_LIMIT_SCALE is read by the shared module when it loads, so config (which loads the .env files) is
 * imported first.
 */
import "../config.js";
import { rateLimit } from "@fashinza/shared/rate-limit.js";
import { rateLimited } from "./errors.js";
import { clientIp } from "./request.js";

export { rateLimit };
export { resetRateLimits } from "@fashinza/shared/rate-limit.js";

export const RATE_LIMIT_MESSAGES = Object.freeze({
  attempts: "Too many attempts from your connection. Please wait a few minutes and try again.",
  messages: "Too many messages from your connection. Please try again in a few minutes.",
  uploads: "Too many uploads. Please wait a few minutes.",
});

/** Throws 429 RATE_LIMITED with `message` when the bucket `key` is exhausted. */
export function enforceRateLimit(key, limit, windowMs, message) {
  if (!rateLimit(key, limit, windowMs).ok) throw rateLimited(message);
}

/** Middleware limiting by client IP with the key `<prefix>:<ip>` (register, forgot, reset, contact). */
export function limitByIp(prefix, limit, windowMs, message) {
  return function rateLimitMiddleware(req, _res, next) {
    enforceRateLimit(`${prefix}:${clientIp(req)}`, limit, windowMs, message);
    next();
  };
}
