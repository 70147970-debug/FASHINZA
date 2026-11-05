import os from "node:os";
import path from "node:path";

/**
 * Settings for the MERN end-to-end suite. The suite drops and re-seeds this database, so it must be a
 * disposable MongoDB database whose name contains "e2e". Credentials below are throwaway test values that only
 * exist in that database.
 */
export const E2E_PORT = 4100;
export const E2E_URL = `http://localhost:${E2E_PORT}`;
export const E2E_MONGODB_URI = process.env.E2E_MONGODB_URI ?? "mongodb://127.0.0.1:27017/fashinza_e2e?replicaSet=rs0";

/** The database name of a MongoDB connection string ("" when it has none). */
export function databaseName(uri) {
  try {
    return decodeURIComponent(new URL(uri).pathname.replace(/^\//, ""));
  } catch {
    return "";
  }
}

if (!/e2e/i.test(databaseName(E2E_MONGODB_URI))) {
  throw new Error("Set E2E_MONGODB_URI to a disposable MongoDB database whose name contains 'e2e'.");
}

/** @type {Record<string, string>} */
export const E2E_ENV = {
  NODE_ENV: "production",
  MONGODB_URI: E2E_MONGODB_URI,
  APP_URL: E2E_URL,
  SERVER_URL: E2E_URL,
  UPLOAD_DIR: path.join(os.tmpdir(), "fashinza-mern-e2e-uploads"),
  PAYMENT_PROVIDER: "sandbox",
  // The suite signs in far more often than a person would; production keeps the normal limits.
  RATE_LIMIT_SCALE: "50",
  PAYMENT_SANDBOX_SECRET: "e2e-sandbox-secret-e2e-sandbox-secret-0001",
  ADMIN_EMAIL: "admin@e2e.test",
  ADMIN_PASSWORD: "E2eAdminPassword1",
  SEED_DEMO: "1",
  SEED_DEMO_PASSWORD: "E2eDemoPassword1",
};

export const ACCOUNTS = {
  admin: { email: E2E_ENV.ADMIN_EMAIL, password: E2E_ENV.ADMIN_PASSWORD },
  knitFactory: { email: "demo-factory-knits@fashinza.test", password: E2E_ENV.SEED_DEMO_PASSWORD },
};
