/**
 * Payment provider adapter (port of src/server/payments/provider.ts). Only the SANDBOX provider is
 * implemented: it imitates a hosted checkout and delivers HMAC-signed webhooks to
 * /api/webhooks/payments/sandbox, exactly like a real provider would, but no money moves. A real provider
 * (e.g. Stripe or a local gateway) would implement the same interface with its API and webhook signature
 * scheme.
 *
 * Fashinza does not hold funds; this is a milestone payment schedule, not regulated escrow.
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { config } from "../config.js";

/**
 * @typedef {{ id: string, type: "payment.succeeded" | "payment.failed" | "refund.succeeded", created: number,
 *   data: { providerRef: string, amount: string, currency: string, reason?: string } }} ProviderEvent
 */

/**
 * @typedef {object} PaymentProvider
 * @property {string} name
 * @property {boolean} isSandbox
 * @property {(input: { amount: string, currency: string, description: string }) => Promise<{ providerRef: string, checkoutUrl: string }>} createCheckout
 * @property {(providerRef: string) => string} checkoutUrl
 * @property {(input: { amount: string, currency: string, paymentRef: string }) => Promise<{ providerRef: string }>} createRefund
 * @property {(rawBody: string, signatureHeader: string | null) => ProviderEvent} verifyWebhook
 */

const TOLERANCE_SECONDS = 300;

function secret() {
  const s = process.env.PAYMENT_SANDBOX_SECRET;
  if (!s || s.length < 32) throw new Error("PAYMENT_SANDBOX_SECRET must be set to at least 32 characters.");
  return s;
}

/** @param {string} rawBody @param {number} timestamp @param {string} [key] */
export function signPayload(rawBody, timestamp, key = secret()) {
  const sig = createHmac("sha256", key).update(`${timestamp}.${rawBody}`).digest("hex");
  return `t=${timestamp},v1=${sig}`;
}

export class WebhookSignatureError extends Error {}

/** @type {PaymentProvider} */
export const sandboxProvider = {
  name: "sandbox",
  isSandbox: true,
  async createCheckout() {
    const providerRef = `sbx_pay_${randomBytes(12).toString("hex")}`;
    return { providerRef, checkoutUrl: this.checkoutUrl(providerRef) };
  },
  checkoutUrl(providerRef) {
    return `/sandbox-checkout/${providerRef}`;
  },
  async createRefund() {
    return { providerRef: `sbx_ref_${randomBytes(12).toString("hex")}` };
  },
  verifyWebhook(rawBody, header) {
    if (!header) throw new WebhookSignatureError("Missing signature header.");
    const parts = Object.fromEntries(header.split(",").map((p) => p.split("=", 2)));
    const t = Number(parts.t);
    if (!Number.isFinite(t) || !parts.v1) throw new WebhookSignatureError("Malformed signature header.");
    if (Math.abs(Date.now() / 1000 - t) > TOLERANCE_SECONDS) throw new WebhookSignatureError("Signature timestamp outside tolerance.");
    const expected = Buffer.from(signPayload(rawBody, t).split("v1=")[1], "hex");
    const actual = Buffer.from(parts.v1, "hex");
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw new WebhookSignatureError("Signature mismatch.");
    /** @type {ProviderEvent} */
    const event = JSON.parse(rawBody);
    if (!event?.id || !event.type || !event.data?.providerRef) throw new WebhookSignatureError("Malformed event.");
    return event;
  },
};

/** @param {string} [name] @returns {PaymentProvider} */
export function getPaymentProvider(name = process.env.PAYMENT_PROVIDER ?? "sandbox") {
  if (name === "sandbox") return sandboxProvider;
  throw new Error(`Payment provider "${name}" is not implemented. Use "sandbox".`);
}

/**
 * Builds and signs a sandbox event (used by the sandbox checkout page and by tests).
 * @param {ProviderEvent["type"]} type @param {ProviderEvent["data"]} data
 */
export function buildSandboxEvent(type, data) {
  /** @type {ProviderEvent} */
  const event = { id: `sbx_evt_${randomBytes(12).toString("hex")}`, type, created: Math.floor(Date.now() / 1000), data };
  const body = JSON.stringify(event);
  return { event, body, signature: signPayload(body, event.created) };
}

/**
 * Base URL the sandbox delivers its webhooks to. The original posted to APP_URL, which was the Next.js app
 * itself. Here the webhook endpoint lives in this API server, so deliveries go to the server's own URL
 * (SERVER_URL, default http://localhost:<PORT>), never to a root APP_URL that may still point at the
 * Next.js app. Tests that listen on a random port override it with setSandboxWebhookBase().
 */
let webhookBase = null;

/** @param {string | null} url */
export function setSandboxWebhookBase(url) {
  webhookBase = url;
}

export function sandboxWebhookBase() {
  return webhookBase ?? config.serverUrl;
}

/**
 * Delivers a signed sandbox event to this application's webhook endpoint over HTTP.
 * @param {ProviderEvent["type"]} type @param {ProviderEvent["data"]} data
 */
export async function deliverSandboxEvent(type, data) {
  const base = sandboxWebhookBase();
  if (!base) throw new Error("SERVER_URL must be set so the sandbox can deliver webhooks.");
  const { body, signature } = buildSandboxEvent(type, data);
  const res = await fetch(new URL("/api/webhooks/payments/sandbox", base), {
    method: "POST",
    headers: { "content-type": "application/json", "x-fashinza-signature": signature },
    body,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Webhook delivery failed with status ${res.status}.`);
}
