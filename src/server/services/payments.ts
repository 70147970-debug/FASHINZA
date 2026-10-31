import { Decimal } from "decimal.js";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { allocateAmounts } from "@/lib/quotation-math";
import { STAGE_BY_KEY } from "@/lib/workflow";
import type { Actor } from "@/server/actor";
import { assertRole } from "@/server/access";
import { conflict, invalid, notFound } from "@/server/errors";
import { audit, logActivity, notify } from "@/server/events";
import { getPaymentProvider, type PaymentProvider, type ProviderEvent, WebhookSignatureError } from "@/server/payments/provider";
import type { MilestoneStage } from "@/generated/prisma/enums";

/** Brand starts paying a due milestone. Returns the provider's checkout URL. */
export async function startPayment(actor: Actor, paymentMilestoneId: string, provider: PaymentProvider = getPaymentProvider()) {
  assertRole(actor, "BRAND");
  const pm = await db.paymentMilestone.findFirst({
    where: { id: paymentMilestoneId, order: { brandId: actor.id } },
    include: { order: { select: { reference: true, id: true } }, transactions: { where: { type: "CHARGE", status: "PENDING" } } },
  });
  if (!pm) throw notFound("Payment milestone");
  if (pm.status === "PROCESSING" && pm.transactions[0]) return provider.checkoutUrl(pm.transactions[0].providerRef);
  if (pm.status !== "DUE" && pm.status !== "FAILED") throw conflict(pm.status === "PAID" ? "This milestone is already paid." : "This milestone is not due yet.");
  const checkout = await provider.createCheckout({ amount: pm.amount.toFixed(2), currency: pm.currency, description: `${pm.order.reference} · ${pm.label}` });
  await db.$transaction(async (tx) => {
    const moved = await tx.paymentMilestone.updateMany({ where: { id: pm.id, status: { in: ["DUE", "FAILED"] } }, data: { status: "PROCESSING" } });
    if (!moved.count) throw conflict("A payment for this milestone is already in progress.");
    await tx.paymentTransaction.create({
      data: { paymentMilestoneId: pm.id, provider: provider.name, providerRef: checkout.providerRef, type: "CHARGE", amount: pm.amount, currency: pm.currency, initiatedById: actor.id },
    });
  });
  return checkout.checkoutUrl;
}

/** Payment milestones and transactions across the actor's orders (all orders for admins). */
export async function listPayments(actor: Actor, f: { status?: string; page?: number } = {}) {
  const pageSize = 20;
  const page = Math.max(1, f.page ?? 1);
  const scope: Prisma.PaymentMilestoneWhereInput =
    actor.role === "ADMIN" ? {} : actor.role === "BRAND" ? { order: { brandId: actor.id } } : { order: { manufacturerId: actor.id } };
  const where: Prisma.PaymentMilestoneWhereInput = { ...scope, ...(f.status ? { status: f.status as never } : {}) };
  const [items, total, totals] = await Promise.all([
    db.paymentMilestone.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        order: { select: { id: true, reference: true, project: { select: { name: true } }, brand: { select: { brandProfile: { select: { companyName: true } } } }, manufacturer: { select: { manufacturerProfile: { select: { businessName: true } } } } } },
        transactions: { orderBy: { createdAt: "desc" } },
      },
    }),
    db.paymentMilestone.count({ where }),
    db.paymentMilestone.groupBy({ by: ["currency", "status"], where: scope, _sum: { amount: true } }),
  ]);
  return { items, total, totals, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

/** The pending charge behind a sandbox checkout page, for the brand who started it. */
export async function getCheckout(actor: Actor, providerRef: string) {
  const tx = await db.paymentTransaction.findFirst({
    where: { providerRef, type: "CHARGE", paymentMilestone: { order: { brandId: actor.id } } },
    include: { paymentMilestone: { include: { order: { select: { id: true, reference: true, project: { select: { name: true } } } } } } },
  });
  if (!tx) throw notFound("Checkout session");
  return tx;
}

export type WebhookResult = { status: "processed" | "duplicate" | "ignored"; detail?: string };

/**
 * Processes a provider webhook. The signature is verified first; each event id is stored once
 * (unique provider + eventId), so redelivered events are acknowledged without being applied twice.
 * State changes are also conditional on the current transaction status, which keeps processing
 * idempotent even if two deliveries of the same event race.
 */
export async function processPaymentWebhook(providerName: string, rawBody: string, signature: string | null): Promise<WebhookResult> {
  const provider = getPaymentProvider(providerName);
  let event: ProviderEvent;
  try {
    event = provider.verifyWebhook(rawBody, signature);
  } catch (e) {
    if (e instanceof WebhookSignatureError || e instanceof SyntaxError) throw invalid(`Webhook rejected: ${e.message}`);
    throw e;
  }

  let record = await db.webhookEvent.findUnique({ where: { provider_eventId: { provider: provider.name, eventId: event.id } } });
  if (record?.processedAt) return { status: "duplicate" };
  if (!record) {
    try {
      record = await db.webhookEvent.create({ data: { provider: provider.name, eventId: event.id, type: event.type, payload: event as unknown as Prisma.InputJsonValue, signatureValid: true } });
    } catch (e) {
      if ((e as { code?: string }).code === "P2002") return { status: "duplicate" };
      throw e;
    }
  }

  try {
    const result = await db.$transaction((tx) => applyEvent(tx, event));
    await db.webhookEvent.update({ where: { id: record.id }, data: { processedAt: new Date(), error: null } });
    return result;
  } catch (e) {
    await db.webhookEvent.update({ where: { id: record.id }, data: { error: (e as Error).message.slice(0, 500) } });
    throw e;
  }
}

async function applyEvent(tx: Prisma.TransactionClient, event: ProviderEvent): Promise<WebhookResult> {
  const txn = await tx.paymentTransaction.findUnique({
    where: { providerRef: event.data.providerRef },
    include: { paymentMilestone: { include: { order: { select: { id: true, reference: true, brandId: true, manufacturerId: true, projectId: true } } } } },
  });
  if (!txn) return { status: "ignored", detail: "Unknown transaction reference." };
  const pm = txn.paymentMilestone;
  const order = pm.order;
  if (!new Decimal(event.data.amount).equals(txn.amount.toString()) || event.data.currency !== txn.currency) {
    throw new Error(`Amount mismatch for ${txn.providerRef}.`);
  }

  if (event.type === "payment.succeeded" || event.type === "payment.failed") {
    if (txn.type !== "CHARGE") return { status: "ignored", detail: "Event type does not match transaction." };
    const succeeded = event.type === "payment.succeeded";
    const moved = await tx.paymentTransaction.updateMany({
      where: { id: txn.id, status: "PENDING" },
      data: { status: succeeded ? "SUCCEEDED" : "FAILED", failureReason: succeeded ? null : (event.data.reason ?? "Payment declined") },
    });
    if (!moved.count) return { status: "ignored", detail: "Transaction already settled." };
    await tx.paymentMilestone.update({ where: { id: pm.id }, data: succeeded ? { status: "PAID", paidAt: new Date() } : { status: "FAILED" } });
    const text = succeeded
      ? `${pm.label} payment of ${pm.currency} ${txn.amount.toFixed(2)} for order ${order.reference} was received.`
      : `${pm.label} payment for order ${order.reference} failed: ${event.data.reason ?? "declined"}.`;
    await notify(tx, [order.brandId, order.manufacturerId], "PAYMENT_UPDATE", succeeded ? "Payment received" : "Payment failed", text, `/orders/${order.id}?tab=payments`);
    await logActivity(tx, { actorId: null, orderId: order.id, projectId: order.projectId, type: succeeded ? "PAYMENT_SUCCEEDED" : "PAYMENT_FAILED", message: text });
    return { status: "processed" };
  }

  if (event.type === "refund.succeeded") {
    if (txn.type !== "REFUND") return { status: "ignored", detail: "Event type does not match transaction." };
    const moved = await tx.paymentTransaction.updateMany({ where: { id: txn.id, status: "PENDING" }, data: { status: "SUCCEEDED" } });
    if (!moved.count) return { status: "ignored", detail: "Refund already settled." };
    await tx.paymentMilestone.update({ where: { id: pm.id }, data: { status: "REFUNDED" } });
    const text = `${pm.label} payment of ${pm.currency} ${txn.amount.toFixed(2)} for order ${order.reference} was refunded.`;
    await notify(tx, [order.brandId, order.manufacturerId], "PAYMENT_UPDATE", "Payment refunded", text, `/orders/${order.id}?tab=payments`);
    await logActivity(tx, { actorId: null, orderId: order.id, projectId: order.projectId, type: "PAYMENT_REFUNDED", message: text });
    return { status: "processed" };
  }
  return { status: "ignored", detail: "Unhandled event type." };
}

/** Admin issues a refund for a paid milestone. Settles when the provider's refund webhook arrives. */
export async function requestRefund(actor: Actor, paymentMilestoneId: string, reason: string, provider: PaymentProvider = getPaymentProvider()) {
  assertRole(actor, "ADMIN");
  const pm = await db.paymentMilestone.findUnique({ where: { id: paymentMilestoneId }, include: { transactions: true } });
  if (!pm) throw notFound("Payment milestone");
  if (pm.status !== "PAID") throw conflict("Only paid milestones can be refunded.");
  if (pm.transactions.some((t) => t.type === "REFUND" && t.status === "PENDING")) throw conflict("A refund is already in progress.");
  const charge = pm.transactions.find((t) => t.type === "CHARGE" && t.status === "SUCCEEDED");
  if (!charge) throw conflict("No successful charge was found for this milestone.");
  const refund = await provider.createRefund({ amount: pm.amount.toFixed(2), currency: pm.currency, paymentRef: charge.providerRef });
  await db.$transaction(async (tx) => {
    await tx.paymentTransaction.create({
      data: { paymentMilestoneId: pm.id, provider: provider.name, providerRef: refund.providerRef, type: "REFUND", amount: pm.amount, currency: pm.currency, initiatedById: actor.id },
    });
    await audit(tx, { actorId: actor.id, action: "PAYMENT_REFUND_REQUESTED", targetType: "PaymentMilestone", targetId: pm.id, reason, metadata: { amount: pm.amount.toFixed(2), currency: pm.currency } });
  });
  return { providerRef: refund.providerRef, amount: pm.amount.toFixed(2), currency: pm.currency };
}

/** Brand changes the payment split. Allowed until any payment has started. */
export async function updatePaymentSchedule(actor: Actor, orderId: string, items: { label: string; percentage: number; triggerStage: MilestoneStage }[]) {
  assertRole(actor, "BRAND");
  await db.$transaction(async (tx) => {
    const order = await tx.order.findFirst({ where: { id: orderId, brandId: actor.id }, include: { paymentMilestones: true, milestones: true } });
    if (!order) throw notFound("Order");
    if (order.paymentMilestones.some((p) => ["PROCESSING", "PAID", "REFUNDED"].includes(p.status))) throw conflict("The schedule cannot change after a payment has started.");
    const stages = new Set(items.map((i) => i.triggerStage));
    if (stages.size !== items.length) throw invalid("Each payment must be tied to a different stage.");
    const amounts = allocateAmounts(order.totalAmount.toString(), items.map((i) => i.percentage));
    const sorted = items.map((it, i) => ({ ...it, amount: amounts[i] })).sort((a, b) => STAGE_BY_KEY[a.triggerStage].sequence - STAGE_BY_KEY[b.triggerStage].sequence);
    const completed = new Set(order.milestones.filter((m) => m.status === "COMPLETED").map((m) => m.stage));
    await tx.paymentMilestone.deleteMany({ where: { orderId } });
    await tx.paymentMilestone.createMany({
      data: sorted.map((it, i) => ({
        orderId,
        sequence: i + 1,
        label: it.label,
        percentage: it.percentage,
        amount: it.amount,
        currency: order.currency,
        triggerStage: it.triggerStage,
        status: completed.has(it.triggerStage) ? "DUE" : "SCHEDULED",
        dueAt: completed.has(it.triggerStage) ? new Date(Date.now() + 7 * 86400000) : null,
      })),
    });
    await logActivity(tx, { actorId: actor.id, orderId, projectId: order.projectId, type: "PAYMENT_SCHEDULE_CHANGED", message: `Payment schedule updated: ${sorted.map((s) => `${s.label} ${s.percentage}%`).join(", ")}.` });
    await notify(tx, order.manufacturerId, "PAYMENT_UPDATE", "Payment schedule changed", `The brand updated the payment schedule for order ${order.reference}.`, `/orders/${orderId}?tab=payments`);
  });
}
