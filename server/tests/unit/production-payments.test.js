/**
 * SERVER-B pieces that need no database: the sandbox payment provider (HMAC signatures), the webhook HTTP
 * layer up to signature verification, route gates, and the PostgreSQL-ordering helpers.
 */
import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { buildSandboxEvent, getPaymentProvider, sandboxProvider, sandboxWebhookBase, setSandboxWebhookBase, signPayload, WebhookSignatureError } from "../../src/payments/provider.js";
import { processPaymentWebhook } from "../../src/services/payments.js";
import { by, nullAwareSort, sortWith } from "../../src/lib/relations.js";
import { oneOf } from "../../src/lib/query.js";
import { sameOrigin } from "../support/http.js";

const app = createApp();

describe("sandbox payment provider", () => {
  it("signs t.<body> with HMAC-SHA256 in the original header format", () => {
    const secret = process.env.PAYMENT_SANDBOX_SECRET;
    const expected = createHmac("sha256", secret).update('1700000000.{"a":1}').digest("hex");
    expect(signPayload('{"a":1}', 1700000000)).toBe(`t=1700000000,v1=${expected}`);
  });

  it("verifies its own events and rejects tampering, stale or malformed signatures", () => {
    const { body, signature, event } = buildSandboxEvent("payment.succeeded", { providerRef: "sbx_pay_1", amount: "10.00", currency: "USD" });
    expect(event.id).toMatch(/^sbx_evt_[a-f0-9]{24}$/);
    expect(sandboxProvider.verifyWebhook(body, signature)).toEqual(event);
    const reason = (fn) => {
      try {
        fn();
      } catch (e) {
        expect(e).toBeInstanceOf(WebhookSignatureError);
        return e.message;
      }
      return "accepted";
    };
    expect(reason(() => sandboxProvider.verifyWebhook(body, null))).toBe("Missing signature header.");
    expect(reason(() => sandboxProvider.verifyWebhook(body, "v1=abc"))).toBe("Malformed signature header.");
    expect(reason(() => sandboxProvider.verifyWebhook(body, "t=1,v1=deadbeef"))).toBe("Signature timestamp outside tolerance.");
    expect(reason(() => sandboxProvider.verifyWebhook(body.replace("10.00", "1.00"), signature))).toBe("Signature mismatch.");
    const t = Math.floor(Date.now() / 1000);
    expect(reason(() => sandboxProvider.verifyWebhook("{}", signPayload("{}", t)))).toBe("Malformed event.");
  });

  it("creates sandbox checkout and refund references", async () => {
    const checkout = await sandboxProvider.createCheckout({ amount: "1.00", currency: "USD", description: "x" });
    expect(checkout.providerRef).toMatch(/^sbx_pay_[a-f0-9]{24}$/);
    expect(checkout.checkoutUrl).toBe(`/sandbox-checkout/${checkout.providerRef}`);
    expect((await sandboxProvider.createRefund({ amount: "1.00", currency: "USD", paymentRef: "x" })).providerRef).toMatch(/^sbx_ref_/);
    expect(getPaymentProvider("sandbox")).toBe(sandboxProvider);
    expect(() => getPaymentProvider("stripe")).toThrow('Payment provider "stripe" is not implemented. Use "sandbox".');
  });

  it("delivers webhooks to this server, overridable for tests", () => {
    expect(sandboxWebhookBase()).toMatch(/^http:\/\/localhost:\d+$/);
    setSandboxWebhookBase("http://127.0.0.1:9");
    expect(sandboxWebhookBase()).toBe("http://127.0.0.1:9");
    setSandboxWebhookBase(null);
  });

  it("rejects unsigned webhooks before touching the database", async () => {
    await expect(processPaymentWebhook("sandbox", "{}", null)).rejects.toMatchObject({ code: "INVALID", message: "Webhook rejected: Missing signature header." });
    const t = Math.floor(Date.now() / 1000);
    await expect(processPaymentWebhook("sandbox", "not json", signPayload("not json", t))).rejects.toMatchObject({ code: "INVALID", message: expect.stringMatching(/^Webhook rejected: /) });
  });
});

describe("webhook endpoint", () => {
  it("answers signature failures with 400 and the original message, without an Origin check", async () => {
    const res = await request(app).post("/api/webhooks/payments/sandbox").set("Origin", "https://elsewhere.example").set("Content-Type", "application/json").send("{}");
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { code: "INVALID", message: "Webhook rejected: Missing signature header." } });
  });

  it("answers unknown providers with 500 Processing failed.", async () => {
    const res = await request(app).post("/api/webhooks/payments/paypal").set("Content-Type", "text/plain").send("{}");
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: { code: "INTERNAL", message: "Processing failed." } });
  });

  it("refuses bodies over 64 KiB", async () => {
    const res = await request(app).post("/api/webhooks/payments/sandbox").set("Content-Type", "application/json").send("x".repeat(65 * 1024));
    expect(res.status).toBe(413);
    expect(res.body).toEqual({ error: { code: "PAYLOAD_TOO_LARGE", message: "Payload too large." } });
  });
});

describe("route gates (signed out)", () => {
  const cases = [
    ["get", "/api/orders"],
    ["get", "/api/orders/0123456789abcdef01234567"],
    ["post", "/api/orders/0123456789abcdef01234567/evidence"],
    ["post", "/api/orders/0123456789abcdef01234567/stages/complete"],
    ["put", "/api/orders/0123456789abcdef01234567/payment-schedule"],
    ["get", "/api/payments"],
    ["post", "/api/payments/milestones/0123456789abcdef01234567/checkout"],
    ["get", "/api/sandbox-checkout/sbx_pay_x"],
    ["post", "/api/sandbox-checkout/sbx_pay_x"],
    ["get", "/api/disputes"],
    ["post", "/api/disputes"],
    ["get", "/api/notifications"],
    ["post", "/api/notifications/read-all"],
    ["post", "/api/notifications/x/open"],
    ["get", "/api/dashboard"],
    ["get", "/api/admin/overview"],
    ["get", "/api/admin/factories"],
    ["post", "/api/admin/payments/milestones/x/refund"],
    ["post", "/api/admin/disputes/x"],
    ["post", "/api/admin/enquiries/x/status"],
  ];
  it.each(cases)("%s %s → 401 Sign in to continue.", async (method, path) => {
    const res = await sameOrigin(request(app)[method](path));
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: { code: "UNAUTHENTICATED", message: "Sign in to continue." } });
  });

  it("still rejects cross-site mutations first", async () => {
    const res = await request(app).post("/api/orders/x/messages").set("Host", "localhost:4000").set("Origin", "https://evil.example");
    expect(res.status).toBe(403);
    expect(res.body.error).toEqual({ code: "FORBIDDEN", message: "Cross-site request rejected." });
  });
});

describe("PostgreSQL ordering helpers", () => {
  it("puts NULLs last ascending and first descending by default, like PostgreSQL", () => {
    const rows = [{ v: 2 }, { v: null }, { v: 1 }];
    expect(sortWith(rows, by((r) => r.v)).map((r) => r.v)).toEqual([1, 2, null]);
    expect(sortWith(rows, by((r) => r.v, { dir: "desc" })).map((r) => r.v)).toEqual([null, 2, 1]);
    expect(sortWith(rows, by((r) => r.v, { nulls: "first" })).map((r) => r.v)).toEqual([null, 1, 2]);
  });

  it("sorts enums in declaration order and dates chronologically", () => {
    const kinds = ["TECH_PACK", "SKETCH", "OTHER"];
    expect(sortWith([{ k: "OTHER" }, { k: "TECH_PACK" }, { k: "SKETCH" }], by((r) => r.k, { enumValues: kinds })).map((r) => r.k)).toEqual(kinds);
    const d = (s) => new Date(s);
    expect(sortWith([{ t: d("2026-02-01") }, { t: d("2026-01-01") }], by((r) => r.t)).map((r) => r.t.getUTCMonth())).toEqual([0, 1]);
  });

  it("builds aggregation stages with explicit null placement", () => {
    const s = nullAwareSort([
      ["dueAt", 1, "last"],
      ["decidedAt", -1, "first"],
    ]);
    expect(s.sort.$sort).toEqual({ __null0: 1, dueAt: 1, __null1: -1, decidedAt: -1 });
    expect(Object.keys(s.addFields.$addFields)).toEqual(["__null0", "__null1"]);
    expect(s.unset).toEqual({ $unset: ["__null0", "__null1"] });
  });

  it("accepts only enum values from query strings", () => {
    expect(oneOf(["DUE", "PAID"], "PAID")).toBe("PAID");
    expect(oneOf(["DUE", "PAID"], "toString")).toBeUndefined();
    expect(oneOf(["DUE", "PAID"], undefined)).toBeUndefined();
  });
});
