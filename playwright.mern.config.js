import { defineConfig, devices } from "@playwright/test";
import { E2E_ENV, E2E_PORT, E2E_URL } from "./tests-mern/e2e/env.js";

/**
 * End-to-end tests for the MERN app (tests-mern/e2e), run against the production MERN server
 * (node server/src/index.js, which also serves client/dist) on its own port and its own disposable MongoDB
 * database (see tests-mern/e2e/env.js). This config builds nothing: run `npm run mern:build` first, then
 * `npm run mern:test:e2e` (which drops and re-seeds the e2e database first).
 */
export default defineConfig({
  testDir: "tests-mern/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  outputDir: "test-results/mern",
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report/mern" }]],
  use: { baseURL: E2E_URL, trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } }, testIgnore: /mobile\.spec/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /mobile\.spec/ },
  ],
  webServer: {
    command: "node server/src/index.js",
    // Waits until the server answers 200, i.e. MongoDB is connected (503 while the database is unreachable).
    url: `${E2E_URL}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { ...E2E_ENV, PORT: String(E2E_PORT) },
  },
});
