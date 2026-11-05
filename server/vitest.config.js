import os from "node:os";
import path from "node:path";
import { defineConfig } from "vitest/config";

// Unit tests never touch a database. MONGODB_URI points at a test name so nothing can reach the dev data.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.js"],
    env: {
      NODE_ENV: "test",
      MONGODB_URI: "mongodb://127.0.0.1:27017/fashinza_unit_test?replicaSet=rs0",
      UPLOAD_DIR: path.join(os.tmpdir(), "fashinza-server-unit-uploads"),
      PAYMENT_PROVIDER: "sandbox",
      PAYMENT_SANDBOX_SECRET: "unit-test-secret-unit-test-secret-unit-test",
    },
  },
});
