import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";

// Smoke test with the real db module and no connection (MongoDB is not started by unit tests).
describe("GET /api/health without a database connection", () => {
  it("answers 503 immediately instead of hanging", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const started = Date.now();
    const res = await request(createApp()).get("/api/health");
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: "error", database: "unreachable" });
    expect(Date.now() - started).toBeLessThan(2000);
    spy.mockRestore();
  });
});
