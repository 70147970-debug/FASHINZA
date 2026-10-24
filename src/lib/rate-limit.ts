/**
 * Small fixed-window rate limiter kept in memory.
 * Good enough for a single server instance; swap for Redis when running several instances.
 */
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

// Multiplies every limit; only raised in automated test environments (e.g. RATE_LIMIT_SCALE=50 for e2e).
const SCALE = Math.max(1, Number(process.env.RATE_LIMIT_SCALE ?? 1) || 1);

export function rateLimit(key: string, baseLimit: number, windowMs: number, now = Date.now()) {
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
