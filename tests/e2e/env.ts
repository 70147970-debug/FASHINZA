import "dotenv/config";
import os from "node:os";
import path from "node:path";

/**
 * Settings for the end-to-end suite. The suite resets this database, so it must be a
 * disposable local database whose name contains "e2e". Credentials below are throwaway test
 * values that only exist in that database.
 */
export const E2E_PORT = 3100;
export const E2E_URL = `http://localhost:${E2E_PORT}`;
export const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? (process.env.TEST_DATABASE_URL ?? "").replace(/fashinza_test/, "fashinza_e2e");
if (!E2E_DATABASE_URL || !/e2e/i.test(E2E_DATABASE_URL)) {
  throw new Error("Set E2E_DATABASE_URL (or TEST_DATABASE_URL) in .env so the e2e suite has a disposable database whose name contains 'e2e'.");
}

export const E2E_ENV: Record<string, string> = {
  DATABASE_URL: E2E_DATABASE_URL,
  APP_URL: E2E_URL,
  UPLOAD_DIR: path.join(os.tmpdir(), "fashinza-e2e-uploads"),
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
