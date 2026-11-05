/**
 * Small fixed-window rate limiter kept in memory.
 * Good enough for a single server instance; swap for Redis when running several instances.
 */

/** @typedef {{ count: number; resetAt: number }} Bucket */
/** @type {Map<string, Bucket>} */
const buckets = new Map();

/** process.env is only defined on the server; in a browser the default scale (1) applies. */
function envScale() {
  try {
    return process.env.RATE_LIMIT_SCALE;
  } catch {
    return undefined;
  }
}

// Multiplies every limit; only raised in automated test environments (e.g. RATE_LIMIT_SCALE=50 for e2e).
const SCALE = Math.max(1, Number(envScale() ?? 1) || 1);

/** @param {string} key @param {number} baseLimit @param {number} windowMs @param {number} [now] */
export function rateLimit(key, baseLimit, windowMs, now = Date.now()) {
  const limit = baseLimit * SCALE;
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterMs: 0 };
  }
  if (bucket.count >= limit) return { ok: false, remaining: 0, retryAfterMs: bucket.resetAt - now };
  bucket.count += 1;
  return { ok: true, remaining: limit - bucket.count, retryAfterMs: 0 };
}

export function resetRateLimits() {
  buckets.clear();
}
