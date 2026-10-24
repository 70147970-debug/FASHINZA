import "dotenv/config";
import path from "node:path";
import os from "node:os";
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// Integration tests run the real services against a real PostgreSQL database.
// They truncate every table, so they refuse to run against anything but a test database.
const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error("Set TEST_DATABASE_URL (a separate, disposable database) to run integration tests.");
if (url === process.env.DATABASE_URL || !/test/i.test(new URL(url).pathname)) {
  throw new Error("TEST_DATABASE_URL must point to a separate database whose name contains 'test'.");
}

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: { alias: { "server-only": path.resolve(__dirname, "tests/support/server-only.ts") } },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    globalSetup: ["tests/support/global-setup.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    env: {
      DATABASE_URL: url,
      UPLOAD_DIR: path.join(os.tmpdir(), "fashinza-test-uploads"),
      PAYMENT_PROVIDER: "sandbox",
      PAYMENT_SANDBOX_SECRET: "integration-test-secret-integration-test-secret",
    },
  },
});
