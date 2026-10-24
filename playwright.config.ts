import { defineConfig, devices } from "@playwright/test";
import { E2E_ENV, E2E_PORT, E2E_URL } from "./tests/e2e/env";

/**
 * End-to-end tests run against the production standalone server (as in the Docker image) on its own port and its own
 * disposable database (see tests/e2e/env.ts). Run `npm run build` first, then `npm run test:e2e` (which resets the e2e database first).
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: { baseURL: E2E_URL, trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } }, testIgnore: /mobile\.spec/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /mobile\.spec/ },
  ],
  webServer: {
    command: "npm run -s start:standalone",
    url: `${E2E_URL}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { ...E2E_ENV, PORT: String(E2E_PORT), HOSTNAME: "localhost" },
  },
});
