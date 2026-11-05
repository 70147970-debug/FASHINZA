/** Vitest setup file for integration tests: one guarded connection per test file. */
import { afterAll, beforeAll } from "vitest";
import { resetRateLimits } from "../../src/lib/rate-limit.js";
import { connectTestDb, disconnectTestDb } from "./db.js";

beforeAll(async () => {
  await connectTestDb();
  resetRateLimits();
});

afterAll(async () => {
  await disconnectTestDb();
});
