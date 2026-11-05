/**
 * SERVER-A HTTP layer checks that need no database: gates (401/403 before any lookup), validation messages,
 * rate limits checked before validation, the Origin check, and the public /me response for visitors.
 * Everything that reads or writes records is covered in tests/integration/auth-access.test.js.
 */
import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { resetRateLimits } from "../../src/lib/rate-limit.js";
import { loginDestination } from "../../src/routes/auth.js";
import { sameOrigin } from "../support/http.js";

const app = createApp({ clientDistDir: "/nonexistent-client-dist", publicDir: "/nonexistent-public" });
let ipSeq = 0;
/** A same-origin request from its own client IP (rate-limit buckets are per IP). */
const post = (path, ip = `10.0.0.${++ipSeq}`) => sameOrigin(request(app).post(path)).set("X-Forwarded-For", ip);

beforeEach(() => resetRateLimits());

describe("GET /api/auth/me", () => {
  it("returns { user: null } for visitors and never 401", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ user: null });
    expect(res.headers["cache-control"]).toBe("no-store");
  });
});

describe("signed-out access to SERVER-A endpoints", () => {
  const gated = [
    ["post", "/api/auth/change-password"],
    ["get", "/api/profile/brand"],
    ["put", "/api/profile/brand"],
    ["get", "/api/profile/factory"],
    ["put", "/api/profile/factory"],
    ["post", "/api/profile/factory/documents"],
    ["delete", "/api/profile/factory/documents/0123456789abcdef01234567"],
    ["post", "/api/profile/factory/verification-request"],
    ["get", "/api/projects"],
    ["get", "/api/projects/0123456789abcdef01234567"],
    ["get", "/api/projects/0123456789abcdef01234567/detail"],
    ["post", "/api/projects/save-step"],
    ["post", "/api/projects/0123456789abcdef01234567/submit"],
    ["post", "/api/projects/0123456789abcdef01234567/rerun-matching"],
    ["post", "/api/projects/0123456789abcdef01234567/cancel"],
    ["delete", "/api/projects/0123456789abcdef01234567"],
    ["post", "/api/projects/0123456789abcdef01234567/attachments"],
    ["delete", "/api/projects/0123456789abcdef01234567/attachments/0123456789abcdef01234567"],
    ["get", "/api/quotations"],
    ["post", "/api/quotations/0123456789abcdef01234567/withdraw"],
    ["post", "/api/quotations/0123456789abcdef01234567/request-revision"],
    ["post", "/api/quotations/0123456789abcdef01234567/reject"],
    ["post", "/api/quotations/0123456789abcdef01234567/accept"],
    ["get", "/api/opportunities"],
    ["get", "/api/opportunities/0123456789abcdef01234567"],
    ["post", "/api/opportunities/0123456789abcdef01234567/quotation"],
    ["get", "/api/files/projects/0123456789abcdef0123456789abcdef.pdf"],
    ["get", "/api/search?q=tee"],
  ];

  it.each(gated)("%s %s → 401 UNAUTHENTICATED", async (method, path) => {
    const res = await sameOrigin(request(app)[method](path));
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: { code: "UNAUTHENTICATED", message: "Sign in to continue." } });
  });

  it("rejects cross-site mutations before anything else", async () => {
    const res = await request(app).post("/api/auth/login").set("Host", "localhost:4000").set("Origin", "https://evil.example").send({ email: "a@b.co", password: "x" });
    expect(res.status).toBe(403);
    expect(res.body.error).toEqual({ code: "FORBIDDEN", message: "Cross-site request rejected." });
  });
});

describe("registration", () => {
  it("validates with the shared schema and today's messages", async () => {
    const res = await post("/api/auth/register").send({ role: "OTHER", name: "A", organization: "O", email: "nope", password: "short", confirmPassword: "x" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID");
    expect(res.body.error.message).toBe("Please correct the highlighted fields.");
    expect(res.body.error.fieldErrors).toMatchObject({
      role: "Choose an account type.",
      name: "Enter your full name.",
      organization: "Enter your company or factory name.",
      email: "Enter a valid email address.",
      password: "Use at least 8 characters.",
    });
  });

  it("accepts multipart and urlencoded form bodies too", async () => {
    const multipart = await post("/api/auth/register").field("role", "BRAND").field("name", "A").field("email", "bad");
    expect(multipart.status).toBe(400);
    expect(multipart.body.error.fieldErrors.name).toBe("Enter your full name.");
    const urlencoded = await post("/api/auth/register").type("form").send("role=BRAND&name=A&email=bad");
    expect(urlencoded.body.error.fieldErrors.email).toBe("Enter a valid email address.");
  });

  it("limits attempts per connection before validating (10 per hour)", async () => {
    for (let i = 0; i < 10; i++) expect((await post("/api/auth/register", "10.9.9.9").send({})).status).toBe(400);
    const res = await post("/api/auth/register", "10.9.9.9").send({});
    expect(res.status).toBe(429);
    expect(res.body.error).toEqual({ code: "RATE_LIMITED", message: "Too many attempts from your connection. Please wait a few minutes and try again." });
  });
});

describe("login", () => {
  it("validates before rate limiting and authenticating", async () => {
    const res = await post("/api/auth/login").send({ email: "not-an-email", password: "" });
    expect(res.status).toBe(400);
    expect(res.body.error.fieldErrors).toEqual({ email: "Enter a valid email address.", password: "Enter your password." });
  });

  it("only allows same-site relative paths as the destination", () => {
    expect(loginDestination("/projects?x=1", "BRAND")).toBe("/projects?x=1");
    expect(loginDestination("//evil.example", "BRAND")).toBe("/dashboard");
    expect(loginDestination("https://evil.example", "ADMIN")).toBe("/admin");
    expect(loginDestination(undefined, "MANUFACTURER")).toBe("/dashboard");
    expect(loginDestination("", undefined)).toBe("/dashboard");
  });
});

describe("password reset", () => {
  it("validates the forgot-password email and limits it to 5 per hour", async () => {
    const bad = await post("/api/auth/forgot-password", "10.8.8.8").send({ email: "x" });
    expect(bad.status).toBe(400);
    expect(bad.body.error.fieldErrors).toEqual({ email: "Enter a valid email address." });
    for (let i = 0; i < 4; i++) await post("/api/auth/forgot-password", "10.8.8.8").send({});
    const limited = await post("/api/auth/forgot-password", "10.8.8.8").send({ email: "a@example.test" });
    expect(limited.status).toBe(429);
  });

  it("checks the new password and its confirmation", async () => {
    const res = await post("/api/auth/reset-password").send({ token: "abcdefghijkl", password: "Password123", confirmPassword: "Password124" });
    expect(res.status).toBe(400);
    expect(res.body.error.fieldErrors).toEqual({ confirmPassword: "Passwords do not match." });
  });
});

describe("contact form", () => {
  it("validates and limits to 5 messages per 10 minutes with its own message", async () => {
    const bad = await post("/api/contact", "10.7.7.7").send({});
    expect(bad.status).toBe(400);
    expect(bad.body.error.message).toBe("Please correct the highlighted fields.");
    expect(Object.keys(bad.body.error.fieldErrors)).toEqual(expect.arrayContaining(["name", "email", "subject", "message"]));
    for (let i = 0; i < 4; i++) await post("/api/contact", "10.7.7.7").send({});
    const limited = await post("/api/contact", "10.7.7.7").send({});
    expect(limited.status).toBe(429);
    expect(limited.body.error.message).toBe("Too many messages from your connection. Please try again in a few minutes.");
  });
});
