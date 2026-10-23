/**
 * Small fixed-window rate limiter kept in memory.
 * Good enough for a single server instance; swap for Redis when running several instances.
 */
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()) {
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
