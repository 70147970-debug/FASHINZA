/** Security headers the Next.js app sent on every response (next.config.ts), plus no-store for the API. */
export function securityHeaders(_req, res, next) {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  });
  next();
}

/** API responses are per-user and must never be cached (routes may override, e.g. file downloads). */
export function noStore(_req, res, next) {
  res.set("Cache-Control", "no-store");
  next();
}
