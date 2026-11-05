/**
 * Express application factory (exported for supertest). Mount order follows docs/mern/api.md §6.2:
 * webhooks (raw body) → health → domain routers → /api 404 → static files + SPA fallback → error handler.
 */
import fs from "node:fs";
import path from "node:path";
import express from "express";
import cookieParser from "cookie-parser";
import { config } from "./config.js";
import { bodyParsers } from "./middleware/body.js";
import { errorHandler, notFoundApi } from "./middleware/errors.js";
import { sameOriginOnly } from "./middleware/origin.js";
import { noStore, securityHeaders } from "./middleware/security.js";

import webhooks from "./routes/webhooks.js";
import health from "./routes/health.js";
import auth from "./routes/auth.js";
import profile from "./routes/profile.js";
import projects from "./routes/projects.js";
import quotations from "./routes/quotations.js";
import opportunities from "./routes/opportunities.js";
import files from "./routes/files.js";
import contact from "./routes/contact.js";
import search from "./routes/search.js";
import orders from "./routes/orders.js";
import payments from "./routes/payments.js";
import sandbox from "./routes/sandbox.js";
import disputes from "./routes/disputes.js";
import notifications from "./routes/notifications.js";
import dashboard from "./routes/dashboard.js";
import admin from "./routes/admin.js";
import { isKnownPage } from "./lib/page-routes.js";

/** Routers after the webhook, in mount order. */
export const ROUTES = [
  ["/api/health", health],
  ["/api/auth", auth],
  ["/api/profile", profile],
  ["/api/projects", projects],
  ["/api/quotations", quotations],
  ["/api/opportunities", opportunities],
  ["/api/files", files],
  ["/api/contact", contact],
  ["/api/search", search],
  ["/api/orders", orders],
  ["/api/payments", payments],
  ["/api/sandbox-checkout", sandbox],
  ["/api/disputes", disputes],
  ["/api/notifications", notifications],
  ["/api/dashboard", dashboard],
  ["/api/admin", admin],
];

/**
 * @param {{ clientDistDir?: string, publicDir?: string }} [options] directories for static serving (tests)
 */
export function createApp(options = {}) {
  const clientDistDir = options.clientDistDir ?? config.clientDistDir;
  const publicDir = options.publicDir ?? config.publicDir;

  const app = express();
  app.disable("x-powered-by");
  app.set("etag", false);
  app.use(securityHeaders);
  app.use(cookieParser());

  // ── API ──────────────────────────────────────────────────────────────
  app.use("/api", noStore);
  // Signature verification needs the exact bytes, so the webhook gets a raw body before any JSON parsing.
  app.use("/api/webhooks", express.raw({ type: "*/*", limit: "64kb" }), webhooks);
  app.use("/api", sameOriginOnly, ...bodyParsers);
  for (const [mount, router] of ROUTES) app.use(mount, router);
  app.use("/api", notFoundApi);

  // ── Static files (production: one process serves the whole app) ─────────
  const indexHtml = path.join(clientDistDir, "index.html");
  // Vite's hashed bundles never change; index.html must always be revalidated. Missing directories simply fall
  // through, so a client build made after the server started is picked up.
  app.use("/assets", express.static(path.join(clientDistDir, "assets"), { immutable: true, maxAge: "1y" }));
  app.use(express.static(clientDistDir, { index: false }));
  app.use(express.static(publicDir, { index: false }));
  // Next served src/app/favicon.ico at /favicon.ico; the built page links a hashed copy, but browsers and
  // crawlers still ask for the conventional path.
  app.get("/favicon.ico", (_req, res, next) => res.sendFile(path.join(clientDistDir, "..", "src", "assets", "favicon.ico"), (err) => err && next()));
  app.get("/{*splat}", (req, res, next) => {
    // Only HTML navigations fall back to the SPA; a missing file (e.g. /images/x.png) stays a 404.
    if (path.extname(req.path) || !fs.existsSync(indexHtml)) return next();
    res.set("Cache-Control", "no-cache");
    // Unknown paths still get the SPA (it renders the not-found page) but with status 404, as in the Next app.
    res.status(isKnownPage(req.path) ? 200 : 404).sendFile(indexHtml);
  });

  app.use(errorHandler);
  return app;
}
