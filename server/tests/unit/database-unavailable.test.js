/**
 * The server keeps serving the client app and public pages while MongoDB is unreachable, and every API call
 * that needs the database answers 503 DATABASE_UNAVAILABLE straight away (no buffering) in the contract's
 * error shape. Unit tests never connect, so this is the real "no database" behaviour.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { createApp } from "../../src/app.js";
import { isDatabaseUnavailable } from "../../src/db.js";
import { INTERNAL_MESSAGES } from "../../src/lib/errors.js";
import { resetRateLimits } from "../../src/lib/rate-limit.js";
import { sameOrigin } from "../support/http.js";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fz-nodb-"));
const clientDistDir = path.join(tmp, "dist");
const publicDir = path.join(tmp, "public");
let app;
let errorSpy;

beforeAll(() => {
  fs.mkdirSync(path.join(clientDistDir, "assets"), { recursive: true });
  fs.mkdirSync(path.join(publicDir, "images"), { recursive: true });
  fs.writeFileSync(path.join(clientDistDir, "index.html"), "<!doctype html><title>Fashinza</title><div id=root></div>");
  fs.writeFileSync(path.join(clientDistDir, "assets", "index-abc123.js"), "console.log(1)");
  fs.writeFileSync(path.join(publicDir, "images", "hero.jpg"), "jpeg");
  app = createApp({ clientDistDir, publicDir });
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterAll(() => {
  errorSpy.mockRestore();
  fs.rmSync(tmp, { recursive: true, force: true });
});
beforeEach(() => resetRateLimits());

const cookie = "fz_session=not-a-real-session-token";

describe("isDatabaseUnavailable", () => {
  it("recognises connection failures, including wrapped ones", () => {
    expect(mongoose.connection.readyState).toBe(0);
    const named = (name, message = "x") => Object.assign(new Error(message), { name });
    expect(isDatabaseUnavailable(named("MongooseServerSelectionError", "connect ECONNREFUSED 127.0.0.1:27017"))).toBe(true);
    expect(isDatabaseUnavailable(named("MongoNetworkError"))).toBe(true);
    expect(isDatabaseUnavailable(named("MongooseError", "Cannot call `user.findOne()` before initial connection is complete"))).toBe(true);
    expect(isDatabaseUnavailable(new Error("outer", { cause: named("MongoNotConnectedError") }))).toBe(true);
    expect(isDatabaseUnavailable(new Error("boom"))).toBe(false);
    expect(isDatabaseUnavailable(named("MongoServerError", "E11000 duplicate key"))).toBe(false);
    expect(isDatabaseUnavailable(null)).toBe(false);
  });
});

describe("API without a database", () => {
  it("answers a signed-in page load with 503 at once instead of waiting for the database", async () => {
    const started = Date.now();
    const res = await request(app).get("/api/auth/me").set("Cookie", cookie);
    expect(Date.now() - started).toBeLessThan(3000);
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ error: { code: "DATABASE_UNAVAILABLE", message: INTERNAL_MESSAGES.route } });
    expect(res.headers["cache-control"]).toBe("no-store");
  });

  it("uses today's mutation message for writes", async () => {
    const res = await sameOrigin(request(app).post("/api/auth/login"))
      .set("X-Forwarded-For", "10.9.9.9")
      .type("form")
      .send({ email: "someone@example.com", password: "Password123" });
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ error: { code: "DATABASE_UNAVAILABLE", message: INTERNAL_MESSAGES.mutation } });
  });

  it("still checks sign-in and validation first, as they need no database", async () => {
    expect((await request(app).get("/api/projects")).status).toBe(401);
    expect((await request(app).get("/api/auth/me")).body).toEqual({ user: null });
    const bad = await sameOrigin(request(app).post("/api/auth/login")).set("X-Forwarded-For", "10.9.9.8").type("form").send({ email: "nope" });
    expect(bad.status).toBe(400);
  });

  it("reports the database in /api/health", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: "error", database: "unreachable" });
  });

  it("keeps serving the client app, its assets and the public files", async () => {
    for (const page of ["/", "/login", "/projects/abc?tab=quotations"]) {
      const res = await request(app).get(page);
      expect(res.status, page).toBe(200);
      expect(res.text).toContain('<div id=root>');
    }
    expect((await request(app).get("/assets/index-abc123.js")).status).toBe(200);
    expect((await request(app).get("/images/hero.jpg")).status).toBe(200);
  });
});
