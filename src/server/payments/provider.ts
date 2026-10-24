import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Payment provider adapter. Only the SANDBOX provider is implemented: it imitates a hosted
 * checkout and delivers HMAC-signed webhooks to /api/webhooks/payments/sandbox, exactly like a
 * real provider would, but no money moves. A real provider (e.g. Stripe or a local gateway)
 * would implement the same interface with its API and webhook signature scheme.
 *
 * Fashinza does not hold funds; this is a milestone payment schedule, not regulated escrow.
 */

export type ProviderEvent = {
  id: string;
  type: "payment.succeeded" | "payment.failed" | "refund.succeeded";
  created: number;
  data: { providerRef: string; amount: string; currency: string; reason?: string };
};

export interface PaymentProvider {
  readonly name: string;
  readonly isSandbox: boolean;
  createCheckout(input: { amount: string; currency: string; description: string }): Promise<{ providerRef: string; checkoutUrl: string }>;
  checkoutUrl(providerRef: string): string;
  createRefund(input: { amount: string; currency: string; paymentRef: string }): Promise<{ providerRef: string }>;
  verifyWebhook(rawBody: string, signatureHeader: string | null): ProviderEvent;
}

const TOLERANCE_SECONDS = 300;

function secret() {
  const s = process.env.PAYMENT_SANDBOX_SECRET;
  if (!s || s.length < 32) throw new Error("PAYMENT_SANDBOX_SECRET must be set to at least 32 characters.");
  return s;
}

export function signPayload(rawBody: string, timestamp: number, key = secret()) {
  const sig = createHmac("sha256", key).update(`${timestamp}.${rawBody}`).digest("hex");
  return `t=${timestamp},v1=${sig}`;
}

export class WebhookSignatureError extends Error {}

export const sandboxProvider: PaymentProvider = {
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
    const parts = Object.fromEntries(header.split(",").map((p) => p.split("=", 2) as [string, string]));
    const t = Number(parts.t);
    if (!Number.isFinite(t) || !parts.v1) throw new WebhookSignatureError("Malformed signature header.");
    if (Math.abs(Date.now() / 1000 - t) > TOLERANCE_SECONDS) throw new WebhookSignatureError("Signature timestamp outside tolerance.");
    const expected = Buffer.from(signPayload(rawBody, t).split("v1=")[1], "hex");
    const actual = Buffer.from(parts.v1, "hex");
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw new WebhookSignatureError("Signature mismatch.");
    const event = JSON.parse(rawBody) as ProviderEvent;
    if (!event?.id || !event.type || !event.data?.providerRef) throw new WebhookSignatureError("Malformed event.");
    return event;
  },
};

export function getPaymentProvider(name = process.env.PAYMENT_PROVIDER ?? "sandbox"): PaymentProvider {
  if (name === "sandbox") return sandboxProvider;
  throw new Error(`Payment provider "${name}" is not implemented. Use "sandbox".`);
}

/** Builds and signs a sandbox event (used by the sandbox checkout page and by tests). */
export function buildSandboxEvent(type: ProviderEvent["type"], data: ProviderEvent["data"]) {
  const event: ProviderEvent = { id: `sbx_evt_${randomBytes(12).toString("hex")}`, type, created: Math.floor(Date.now() / 1000), data };
  const body = JSON.stringify(event);
  return { event, body, signature: signPayload(body, event.created) };
}

/** Delivers a signed sandbox event to this application's webhook endpoint over HTTP. */
export async function deliverSandboxEvent(type: ProviderEvent["type"], data: ProviderEvent["data"]) {
  const base = process.env.APP_URL;
  if (!base) throw new Error("APP_URL must be set so the sandbox can deliver webhooks.");
  const { body, signature } = buildSandboxEvent(type, data);
  const res = await fetch(new URL("/api/webhooks/payments/sandbox", base), {
    method: "POST",
    headers: { "content-type": "application/json", "x-fashinza-signature": signature },
    body,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Webhook delivery failed with status ${res.status}.`);
}
