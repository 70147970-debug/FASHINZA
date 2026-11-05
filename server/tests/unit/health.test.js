import { afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

const ping = vi.fn();
vi.mock("../../src/db.js", async (importOriginal) => ({ ...(await importOriginal()), pingDb: () => ping() }));

const { createApp } = await import("../../src/app.js");

afterEach(() => ping.mockReset());

describe("GET /api/health", () => {
  it("reports ok with latency when the database answers", async () => {
    ping.mockResolvedValue(undefined);
    const res = await request(createApp()).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "ok", database: "ok" });
    expect(typeof res.body.latencyMs).toBe("number");
    expect(new Date(res.body.time).toISOString()).toBe(res.body.time);
    expect(res.headers["cache-control"]).toBe("no-store");
  });

  it("reports 503 when the database is unreachable", async () => {
    ping.mockRejectedValue(new Error("connect ECONNREFUSED"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await request(createApp()).get("/api/health");
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: "error", database: "unreachable" });
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
