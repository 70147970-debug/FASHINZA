import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import dotenv from "dotenv";
import { defineConfig } from "vitest/config";
import { assertTestDatabaseUri, DEFAULT_TEST_MONGODB_URI } from "./tests/support/guard.js";

// Integration tests run the real services against a real MongoDB (single-node replica set, transactions on).
// They wipe every collection, so they refuse to run against anything but a database whose name contains "test".
const uri = process.env.TEST_MONGODB_URI || DEFAULT_TEST_MONGODB_URI;
assertTestDatabaseUri(uri, appMongoUri());

/** The application's MONGODB_URI (process env, else server/.env, else root .env), read without applying it. */
function appMongoUri() {
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI;
  for (const file of [new URL("./.env", import.meta.url), new URL("../.env", import.meta.url)]) {
    try {
      const value = dotenv.parse(fs.readFileSync(file, "utf8")).MONGODB_URI;
      if (value) return value;
    } catch {
      // missing file
    }
  }
  return "mongodb://127.0.0.1:27017/fashinza?replicaSet=rs0";
}

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.js"],
    setupFiles: ["tests/support/integration-setup.js"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    env: {
      NODE_ENV: "test",
      TEST_MONGODB_URI: uri,
      MONGODB_URI: uri,
      UPLOAD_DIR: path.join(os.tmpdir(), "fashinza-test-uploads"),
      PAYMENT_PROVIDER: "sandbox",
      PAYMENT_SANDBOX_SECRET: "integration-test-secret-integration-test-secret",
    },
  },
});
