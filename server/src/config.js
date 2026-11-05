/**
 * Server configuration.
 *
 * Environment files are read in this order:
 *   1. the ROOT .env (shared with the original Next.js app; read-only, never written),
 *   2. server/.env (optional; overrides values from the root .env).
 * Variables already present in the real process environment always win over both files, so test runners
 * and process managers can set values explicitly. Secret values are never printed.
 *
 * Server-specific variables (all optional): PORT (4000), MONGODB_URI
 * (mongodb://127.0.0.1:27017/fashinza?replicaSet=rs0), SERVER_URL (http://localhost:<PORT>, for server-to-self
 * calls), TEST_MONGODB_URI (integration tests; name must contain "test"). Shared with the root app: APP_URL,
 * UPLOAD_DIR (relative paths resolve against the repo root), PAYMENT_PROVIDER, PAYMENT_SANDBOX_SECRET,
 * ADMIN_EMAIL, ADMIN_PASSWORD, SEED_DEMO, SEED_DEMO_PASSWORD, NEXT_PUBLIC_CONTACT_EMAIL, RATE_LIMIT_SCALE.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const here = path.dirname(fileURLToPath(import.meta.url));
export const SERVER_ROOT = path.resolve(here, "..");
export const REPO_ROOT = path.resolve(SERVER_ROOT, "..");

/**
 * Applies env files to `env` without overriding variables that were set before loading.
 * Later files override earlier files. Exported for tests.
 * @param {NodeJS.ProcessEnv} env
 * @param {string[]} files
 * @returns {string[]} the keys that were applied
 */
export function loadEnvFiles(env, files) {
  const preset = new Set(Object.keys(env));
  /** @type {Record<string, string>} */
  const merged = {};
  for (const file of files) {
    let text;
    try {
      text = fs.readFileSync(file, "utf8");
    } catch {
      continue; // missing file is fine
    }
    Object.assign(merged, dotenv.parse(text));
  }
  const applied = [];
  for (const [key, value] of Object.entries(merged)) {
    if (preset.has(key)) continue;
    env[key] = value;
    applied.push(key);
  }
  return applied;
}

loadEnvFiles(process.env, [path.join(REPO_ROOT, ".env"), path.join(SERVER_ROOT, ".env")]);

const env = process.env;

/** Relative paths are resolved against the repository root (where the original app ran from). */
function resolveFromRoot(p) {
  return path.resolve(REPO_ROOT, p);
}

const uploadDir = resolveFromRoot(env.UPLOAD_DIR || "uploads");

// Private uploads must never be reachable as static files.
for (const forbidden of [path.join(REPO_ROOT, "public"), path.join(REPO_ROOT, "client")]) {
  const rel = path.relative(forbidden, uploadDir);
  if (rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel))) {
    throw new Error(`UPLOAD_DIR must be outside ${path.relative(REPO_ROOT, forbidden)}/ (private uploads would become public).`);
  }
}

const port = Number(env.PORT) || 4000;

export const config = Object.freeze({
  env: env.NODE_ENV ?? "development",
  isProduction: env.NODE_ENV === "production",
  isTest: env.NODE_ENV === "test" || Boolean(env.VITEST),
  port,
  mongodbUri: env.MONGODB_URI || "mongodb://127.0.0.1:27017/fashinza?replicaSet=rs0",
  /** Public base URL (password-reset links, sandbox webhook delivery). Undefined when not configured. */
  appUrl: env.APP_URL || undefined,
  /** This API server's own base URL, for server-to-self calls. */
  serverUrl: env.SERVER_URL || `http://localhost:${port}`,
  uploadDir,
  publicDir: path.join(REPO_ROOT, "public"),
  clientDistDir: path.join(REPO_ROOT, "client", "dist"),
  paymentProvider: env.PAYMENT_PROVIDER || "sandbox",
  paymentSandboxSecret: env.PAYMENT_SANDBOX_SECRET || undefined,
  adminEmail: env.ADMIN_EMAIL || undefined,
  adminPassword: env.ADMIN_PASSWORD || undefined,
  seedDemo: env.SEED_DEMO === "1",
  seedDemoPassword: env.SEED_DEMO_PASSWORD || undefined,
  contactEmail: env.NEXT_PUBLIC_CONTACT_EMAIL || "contact@fashinza.example",
  rateLimitScale: Math.max(1, Number(env.RATE_LIMIT_SCALE ?? 1) || 1),
});

/** Keys whose values must never be logged. */
export const SECRET_KEYS = ["PAYMENT_SANDBOX_SECRET", "ADMIN_PASSWORD", "SEED_DEMO_PASSWORD", "MONGODB_URI", "DATABASE_URL"];

/** MongoDB URI with credentials removed, safe for logs. */
export function redactUri(uri) {
  try {
    const u = new URL(uri);
    if (u.username || u.password) {
      u.username = "***";
      u.password = "";
    }
    return u.toString();
  } catch {
    return "(invalid MONGODB_URI)";
  }
}
