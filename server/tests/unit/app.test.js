import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import { z } from "zod";
import { createApp, ROUTES } from "../../src/app.js";
import { bodyParsers } from "../../src/middleware/body.js";
import { errorHandler, notFoundApi, routeHandlerErrors } from "../../src/middleware/errors.js";
import { sameOriginOnly } from "../../src/middleware/origin.js";
import { conflict, invalid, notFound } from "../../src/lib/errors.js";
import { filesOf, ok, parseForm, readForm, validateForm } from "../../src/lib/form.js";
import { clientIp } from "../../src/lib/request.js";
import { sameOrigin } from "../support/http.js";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fz-app-"));
const clientDistDir = path.join(tmp, "dist");
const publicDir = path.join(tmp, "public");

beforeAll(() => {
  fs.mkdirSync(path.join(clientDistDir, "assets"), { recursive: true });
  fs.mkdirSync(path.join(publicDir, "images"), { recursive: true });
  fs.writeFileSync(path.join(clientDistDir, "index.html"), "<!doctype html><title>Fashinza</title><div id=root></div>");
  fs.writeFileSync(path.join(clientDistDir, "assets", "index-abc123.js"), "console.log(1)");
  fs.writeFileSync(path.join(publicDir, "images", "hero.jpg"), "jpeg");
});
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

/** A test app with the real /api pipeline plus a probe router. */
function probeApp(register) {
  const app = express();
  const router = express.Router();
  register(router);
  app.use("/api", sameOriginOnly, ...bodyParsers);
  app.use("/api/probe", router);
  app.use("/api", notFoundApi);
  app.use(errorHandler);
  return app;
}

describe("createApp", () => {
  let app;
  beforeAll(() => {
    app = createApp({ clientDistDir, publicDir });
  });

  it("mounts one router per domain in the contract's order", () => {
    expect(ROUTES.map(([m]) => m)).toEqual([
      "/api/health", "/api/auth", "/api/profile", "/api/projects", "/api/quotations", "/api/opportunities", "/api/files",
      "/api/contact", "/api/search", "/api/orders", "/api/payments", "/api/sandbox-checkout", "/api/disputes",
      "/api/notifications", "/api/dashboard", "/api/admin",
    ]);
  });

  it("answers unknown /api routes with the NOT_FOUND error shape and no-store", async () => {
    const res = await request(app).get("/api/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: "NOT_FOUND", message: "Not found." } });
    expect(res.headers["cache-control"]).toBe("no-store");
  });

  it("sends the security headers of next.config.ts and no X-Powered-By", async () => {
    const res = await request(app).get("/api/does-not-exist");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBe("DENY");
    expect(res.headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(res.headers["permissions-policy"]).toBe("camera=(), microphone=(), geolocation=()");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  it("serves the SPA for page URLs, built assets and public photos", async () => {
    for (const url of ["/", "/projects/abc?tab=quotations", "/admin/factories", "/sandbox-checkout/sbx_ref_1"]) {
      const res = await request(app).get(url);
      expect(res.status, url).toBe(200);
      expect(res.text).toContain('<div id=root>');
      expect(res.headers["cache-control"]).toBe("no-cache");
    }
    const asset = await request(app).get("/assets/index-abc123.js");
    expect(asset.status).toBe(200);
    expect(asset.headers["cache-control"]).toContain("immutable");
    const photo = await request(app).get("/images/hero.jpg");
    expect(photo.status).toBe(200);
    expect(photo.text ?? photo.body.toString()).toBeDefined();
  });

  it("serves the SPA with status 404 for unknown page URLs, as the Next not-found page did", async () => {
    for (const url of ["/this-page-does-not-exist", "/projects/abc/nope", "/admin/unknown"]) {
      const res = await request(app).get(url);
      expect(res.status, url).toBe(404);
      expect(res.text).toContain("<div id=root>");
    }
    expect((await request(app).get("/about/")).status).toBe(200);
  });

  it("does not turn missing files or API paths into the SPA", async () => {
    expect((await request(app).get("/images/missing.jpg")).status).toBe(404);
    expect((await request(app).get("/api/nothing")).body.error.code).toBe("NOT_FOUND");
  });

  it("rejects webhook bodies over 64 KiB with PAYLOAD_TOO_LARGE", async () => {
    const res = await request(app)
      .post("/api/webhooks/payments/sandbox")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ pad: "x".repeat(70 * 1024) }));
    expect(res.status).toBe(413);
    expect(res.body).toEqual({ error: { code: "PAYLOAD_TOO_LARGE", message: "Payload too large." } });
  });
});

describe("cross-site protection", () => {
  const app = probeApp((r) => {
    r.post("/", (_req, res) => ok(res));
    r.get("/", (_req, res) => ok(res));
  });

  it("allows same-origin posts and posts without an Origin header", async () => {
    expect((await sameOrigin(request(app).post("/api/probe"))).status).toBe(200);
    expect((await request(app).post("/api/probe")).status).toBe(200);
  });

  it("rejects cross-site posts with 403 FORBIDDEN", async () => {
    const res = await request(app).post("/api/probe").set("Origin", "https://evil.example");
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: { code: "FORBIDDEN", message: "Cross-site request rejected." } });
    const opaque = await request(app).post("/api/probe").set("Origin", "null");
    expect(opaque.status).toBe(403);
  });

  it("compares against X-Forwarded-Host when present (Vite proxy / reverse proxy)", async () => {
    const res = await request(app).post("/api/probe").set("Origin", "http://localhost:5173").set("X-Forwarded-Host", "localhost:5173");
    expect(res.status).toBe(200);
  });

  it("never blocks GET requests or the payment webhook", async () => {
    expect((await request(app).get("/api/probe").set("Origin", "https://evil.example")).status).toBe(200);
    const full = createApp({ clientDistDir, publicDir });
    const res = await request(full).post("/api/webhooks/payments/sandbox").set("Origin", "https://evil.example").send("{}");
    expect(res.status).not.toBe(403);
  });
});

describe("error responses", () => {
  const app = probeApp((r) => {
    r.post("/invalid", () => {
      throw invalid("Please correct the highlighted fields.", { email: "Enter a valid email address." });
    });
    r.post("/conflict", async () => {
      throw conflict("This project has already been submitted.");
    });
    r.get("/missing", () => {
      throw notFound("Project");
    });
    r.post("/boom", () => {
      throw new Error("db password leaked?");
    });
    r.get("/boom", () => {
      throw new Error("internal detail");
    });
    r.post("/upload-boom", routeHandlerErrors, () => {
      throw new Error("internal detail");
    });
  });

  it("maps AppError codes to statuses with the contract's shape", async () => {
    let res = await request(app).post("/api/probe/invalid");
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { code: "INVALID", message: "Please correct the highlighted fields.", fieldErrors: { email: "Enter a valid email address." } } });
    res = await request(app).post("/api/probe/conflict");
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: { code: "CONFLICT", message: "This project has already been submitted." } });
    res = await request(app).get("/api/probe/missing");
    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe("Project was not found or you do not have access to it.");
  });

  it("hides unexpected errors behind today's generic messages", async () => {
    const errors = [];
    const original = console.error;
    console.error = (...a) => errors.push(a);
    try {
      let res = await request(app).post("/api/probe/boom");
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: { code: "INTERNAL", message: "Something went wrong on our side. Your changes were not saved — please try again." } });
      res = await request(app).get("/api/probe/boom");
      expect(res.body.error.message).toBe("Something went wrong. Please try again.");
      res = await request(app).post("/api/probe/upload-boom");
      expect(res.body.error.message).toBe("Something went wrong. Please try again.");
      expect(JSON.stringify(res.body)).not.toContain("internal detail");
    } finally {
      console.error = original;
    }
    expect(errors.length).toBe(3);
  });
});

describe("readForm / parseForm", () => {
  const app = probeApp((r) => {
    r.post("/form", (req, res) => res.json(readForm(req, ["fabrics", "sizes"])));
    r.post("/files", (req, res) => {
      const files = filesOf(req, "photos");
      res.json({ fields: readForm(req), files: files.map((f) => ({ name: f.originalname, type: f.mimetype, size: f.size })) });
    });
  });

  it("normalises multipart bodies like formObject()", async () => {
    const res = await request(app)
      .post("/api/probe/form")
      .field("name", "First")
      .field("name", "Last wins")
      .field("fabrics", "Cotton")
      .field("fabrics", " ")
      .field("fabrics", "Linen")
      .field("$ACTION_ID_abc", "x");
    expect(res.body).toEqual({ name: "Last wins", fabrics: ["Cotton", "Linen"], sizes: [] });
  });

  it("normalises urlencoded bodies the same way", async () => {
    const res = await request(app).post("/api/probe/form").type("form").send("name=a&name=b&sizes=S&sizes=&sizes=M");
    expect(res.body).toEqual({ name: "b", fabrics: [], sizes: ["S", "M"] });
  });

  it("takes JSON values as sent and wraps single strings for array keys", async () => {
    const res = await request(app).post("/api/probe/form").send({ name: "x", quantity: 500, fabrics: "Cotton", sizes: ["S", "", "M"] });
    expect(res.body).toEqual({ name: "x", quantity: 500, fabrics: ["Cotton"], sizes: ["S", "M"] });
  });

  it("keeps files out of the object and exposes non-empty files by field", async () => {
    const res = await request(app)
      .post("/api/probe/files")
      .field("description", "Fit sample")
      .attach("photos", Buffer.from([0x89, 0x50, 0x4e, 0x47]), { filename: "front café.png", contentType: "image/png" })
      .attach("photos", Buffer.alloc(0), { filename: "empty.png", contentType: "image/png" })
      .attach("other", Buffer.from("x"), { filename: "x.pdf", contentType: "application/pdf" });
    expect(res.body.fields).toEqual({ description: "Fit sample" });
    expect(res.body.files).toEqual([{ name: "front café.png", type: "image/png", size: 4 }]);
  });

  it("reports a file over 10 MB with today's message when the route reads its files", async () => {
    const res = await request(app)
      .post("/api/probe/files")
      .attach("photos", Buffer.alloc(10 * 1024 * 1024 + 1, 1), { filename: "big.png", contentType: "image/png" });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { code: "INVALID", message: "Files must be 10 MB or smaller." } });
  });

  it("parseForm returns zod field errors (first issue per key) with the standard message", () => {
    const schema = z.object({ email: z.string().email("Enter a valid email address."), name: z.string().min(2, "Too short").min(3, "Also short") });
    const result = parseForm(schema, { email: "nope", name: "a" });
    expect(result.ok).toBe(false);
    expect(result.error.code).toBe("INVALID");
    expect(result.error.message).toBe("Please correct the highlighted fields.");
    expect(result.error.fieldErrors).toEqual({ email: "Enter a valid email address.", name: "Too short" });
    expect(validateForm(schema, { email: "a@b.co", name: "abc" })).toEqual({ email: "a@b.co", name: "abc" });
    expect(() => validateForm(schema, {})).toThrow("Please correct the highlighted fields.");
  });
});

describe("clientIp", () => {
  const fakeReq = (headers) => ({ get: (h) => headers[h.toLowerCase()] });
  it("uses the first X-Forwarded-For entry, then X-Real-IP, else unknown", () => {
    expect(clientIp(fakeReq({ "x-forwarded-for": " 198.51.100.7 , 10.0.0.1" }))).toBe("198.51.100.7");
    expect(clientIp(fakeReq({ "x-real-ip": "203.0.113.5" }))).toBe("203.0.113.5");
    expect(clientIp(fakeReq({}))).toBe("unknown");
  });
});
