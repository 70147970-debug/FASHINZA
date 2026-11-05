/**
 * Best-effort client IP for rate limiting (port of src/lib/request.ts). Behind a proxy, x-forwarded-for is
 * set by the platform. Deliberately does not use req.ip.
 * @param {import("express").Request} req
 */
export function clientIp(req) {
  const forwarded = req.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || req.get("x-real-ip") || "unknown";
}

/** First 300 characters of the user agent, as stored on sessions. */
export function userAgent(req) {
  return req.get("user-agent")?.slice(0, 300);
}
