/**
 * The client's page URLs (client/src/router.jsx), so the SPA fallback can answer unknown paths with HTTP 404 as
 * the Next app did (its not-found page was served with status 404; the page itself is rendered by the client).
 * server/tests/unit/page-routes.test.js keeps this list in step with the router.
 */
export const PAGE_PATHS = [
  "/",
  "/about", "/contact", "/faq", "/for-brands", "/for-manufacturers", "/how-it-works", "/privacy", "/sustainability", "/terms",
  "/login", "/register", "/forgot-password", "/reset-password",
  "/onboarding", "/dashboard",
  "/projects", "/projects/new", "/projects/:id", "/projects/:id/edit",
  "/opportunities", "/opportunities/:id", "/quotations",
  "/orders", "/orders/:id", "/payments", "/disputes", "/disputes/:id",
  "/notifications", "/profile", "/factory", "/settings", "/search",
  "/admin", "/admin/factories", "/admin/factories/:id", "/admin/users", "/admin/orders", "/admin/qc", "/admin/disputes",
  "/admin/payments", "/admin/audit", "/admin/enquiries",
  "/sandbox-checkout/:ref", "/notifications/:id",
];

const PATTERNS = PAGE_PATHS.map((p) => new RegExp(`^${p.replace(/:[A-Za-z]+/g, "[^/]+")}$`));

/** Whether a request path is one of the client's pages (a trailing slash is ignored, as React Router does). */
export function isKnownPage(pathname) {
  const p = pathname.length > 1 ? pathname.replace(/\/+$/, "") || "/" : pathname;
  return PATTERNS.some((re) => re.test(p));
}
