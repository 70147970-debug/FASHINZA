/**
 * Milestone payments: checkout, webhooks (idempotent), refunds and the payment schedule
 * (port of src/server/services/payments.ts).
 */
import Decimal from "decimal.js";
import { PaymentMilestoneStatus } from "@fashinza/shared/enums.js";
import { allocateAmounts } from "@fashinza/shared/quotation-math.js";
import { STAGE_BY_KEY } from "@fashinza/shared/workflow.js";
import { isDuplicateKeyError, withTransaction } from "../db.js";
import { assertRole } from "../lib/access.js";
import { conflict, invalid, notFound } from "../lib/errors.js";
import { audit, logActivity, notify } from "../lib/events.js";
import { idOf, toObjectId } from "../lib/ids.js";
import { by, groupByRef, mapById, oneByRef, sortWith } from "../lib/relations.js";
import { money, serialize } from "../lib/serialize.js";
import { BrandProfile, ManufacturerProfile, Order, PaymentMilestone, PaymentTransaction, ProductionMilestone, Project, WebhookEvent } from "../models/index.js";
import { getPaymentProvider, WebhookSignatureError } from "../payments/provider.js";

const DAY = 86400000;

/**
 * Payment milestone (lean) whose order belongs to the brand, else null.
 * @param {import("mongoose").ClientSession | null} [session]
 */
async function brandMilestone(actor, paymentMilestoneId, session = null) {
  const id = toObjectId(paymentMilestoneId);
  const pm = id ? await PaymentMilestone.findById(id).session(session).lean() : null;
  if (!pm) return null;
  const order = await Order.findOne({ _id: pm.orderId, brandId: toObjectId(actor.id) }, { reference: 1 }).session(session).lean();
  return order ? { ...pm, order } : null;
}

/** Brand starts paying a due milestone. Returns the provider's checkout URL. */
export async function startPayment(actor, paymentMilestoneId, provider = getPaymentProvider()) {
  assertRole(actor, "BRAND");
  const pm = await brandMilestone(actor, paymentMilestoneId);
  if (!pm) throw notFound("Payment milestone");
  const pending = await PaymentTransaction.findOne({ paymentMilestoneId: pm._id, type: "CHARGE", status: "PENDING" }).sort({ createdAt: 1, _id: 1 }).lean();
  if (pm.status === "PROCESSING" && pending) return provider.checkoutUrl(pending.providerRef);
  if (pm.status !== "DUE" && pm.status !== "FAILED") throw conflict(pm.status === "PAID" ? "This milestone is already paid." : "This milestone is not due yet.");
  const amount = money(pm.amount, 2);
  const checkout = await provider.createCheckout({ amount, currency: pm.currency, description: `${pm.order.reference} · ${pm.label}` });
  await withTransaction(async (session) => {
    const moved = await PaymentMilestone.updateOne({ _id: pm._id, status: { $in: ["DUE", "FAILED"] } }, { $set: { status: "PROCESSING" } }, { session });
    if (!moved.modifiedCount) throw conflict("A payment for this milestone is already in progress.");
    await PaymentTransaction.create(
      [{ paymentMilestoneId: pm._id, provider: provider.name, providerRef: checkout.providerRef, type: "CHARGE", amount, currency: pm.currency, initiatedById: toObjectId(actor.id) }],
      { session },
    );
  });
  return checkout.checkoutUrl;
}

/** Order ids in the actor's payment scope (null = everything, for admins). */
async function scopeOrderIds(actor) {
  if (actor.role === "ADMIN") return null;
  const field = actor.role === "BRAND" ? "brandId" : "manufacturerId";
  return Order.distinct("_id", { [field]: toObjectId(actor.id) });
}

/**
 * Prisma groupBy of payment milestones with `_sum: { amount }` (and optionally `_count`), sorted by the
 * `by` keys ascending (enum keys in declaration order).
 * @param {Record<string, unknown>} match
 * @param {string[]} keys
 * @param {{ count?: boolean }} [o]
 */
export async function groupPaymentMilestones(match, keys, o = {}) {
  const rows = await PaymentMilestone.aggregate([
    { $match: match },
    { $group: { _id: Object.fromEntries(keys.map((k) => [k, `$${k}`])), amount: { $sum: "$amount" }, count: { $sum: 1 } } },
  ]);
  const out = rows.map((r) => {
    /** @type {Record<string, unknown>} */
    const row = {};
    for (const k of keys) {
      const v = r._id[k];
      row[k] = v && typeof v === "object" ? idOf(v) : v;
    }
    row._sum = { amount: money(r.amount, 2) };
    if (o.count) row._count = r.count;
    return row;
  });
  const comparators = keys.map((k) => (k === "status" ? by((r) => r[k], { enumValues: PaymentMilestoneStatus }) : by((r) => r[k])));
  return sortWith(out, ...comparators);
}

/** Payment milestones and transactions across the actor's orders (all orders for admins). */
export async function listPayments(actor, f = {}) {
  const pageSize = 20;
  const page = Math.max(1, f.page ?? 1);
  const orderIds = await scopeOrderIds(actor);
  const scope = orderIds ? { orderId: { $in: orderIds } } : {};
  const where = { ...scope, ...(f.status ? { status: f.status } : {}) };
  const [rows, total, totals] = await Promise.all([
    PaymentMilestone.aggregate([
      { $match: where },
      { $lookup: { from: Order.collection.name, localField: "orderId", foreignField: "_id", as: "__order", pipeline: [{ $project: { createdAt: 1 } }] } },
      { $addFields: { __orderCreatedAt: { $first: "$__order.createdAt" } } },
      // Grouped by order (newest order first), then in schedule order, so one order's milestones stay together.
      { $sort: { __orderCreatedAt: -1, orderId: 1, sequence: 1 } },
      { $skip: (page - 1) * pageSize },
      { $limit: pageSize },
      { $unset: ["__order", "__orderCreatedAt"] },
    ]),
    PaymentMilestone.countDocuments(where),
    groupPaymentMilestones(scope, ["currency", "status"]),
  ]);
  const ids = rows.map((r) => r.orderId);
  const [orders, transactions] = await Promise.all([
    mapById(Order, ids, { reference: 1, projectId: 1, brandId: 1, manufacturerId: 1 }),
    groupByRef(PaymentTransaction, "paymentMilestoneId", rows.map((r) => r._id), { sort: { createdAt: -1, _id: -1 } }),
  ]);
  const orderList = [...orders.values()];
  const [projects, brandProfiles, factoryProfiles] = await Promise.all([
    mapById(Project, orderList.map((o) => o.projectId), { name: 1 }),
    oneByRef(BrandProfile, "userId", orderList.map((o) => o.brandId), { userId: 1, companyName: 1 }),
    oneByRef(ManufacturerProfile, "userId", orderList.map((o) => o.manufacturerId), { userId: 1, businessName: 1 }),
  ]);
  const items = rows.map((r) => {
    const o = orders.get(idOf(r.orderId));
    const bp = o && brandProfiles.get(idOf(o.brandId));
    const mp = o && factoryProfiles.get(idOf(o.manufacturerId));
    const p = o && projects.get(idOf(o.projectId));
    return {
      ...serialize(PaymentMilestone, r),
      order: o
        ? {
            id: idOf(o._id),
            reference: o.reference,
            project: p ? { name: p.name } : null,
            brand: { brandProfile: bp ? { companyName: bp.companyName } : null },
            manufacturer: { manufacturerProfile: mp ? { businessName: mp.businessName } : null },
          }
        : null,
      transactions: serialize(PaymentTransaction, transactions.get(idOf(r._id)) ?? []),
    };
  });
  return { items, total, totals, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

/** The pending charge behind a sandbox checkout page, for the brand who started it. */
export async function getCheckout(actor, providerRef) {
  const txn = typeof providerRef === "string" ? await PaymentTransaction.findOne({ providerRef, type: "CHARGE" }).lean() : null;
  const pm = txn ? await PaymentMilestone.findById(txn.paymentMilestoneId).lean() : null;
  const order = pm ? await Order.findOne({ _id: pm.orderId, brandId: toObjectId(actor.id) }, { reference: 1, projectId: 1 }).lean() : null;
  if (!txn || !pm || !order) throw notFound("Checkout session");
  const project = await Project.findById(order.projectId, { name: 1 }).lean();
  return {
    ...serialize(PaymentTransaction, txn),
    paymentMilestone: {
      ...serialize(PaymentMilestone, pm),
      order: { id: idOf(order._id), reference: order.reference, project: project ? { name: project.name } : null },
    },
  };
}

/**
 * Processes a provider webhook. The signature is verified first; each event id is stored once
 * (unique provider + eventId), so redelivered events are acknowledged without being applied twice.
 * State changes are also conditional on the current transaction status, which keeps processing
 * idempotent even if two deliveries of the same event race.
 * @param {string} providerName
 * @param {string} rawBody
 * @param {string | null} signature
 * @returns {Promise<{ status: "processed" | "duplicate" | "ignored", detail?: string }>}
 */
export async function processPaymentWebhook(providerName, rawBody, signature) {
  const provider = getPaymentProvider(providerName);
  let event;
  try {
    event = provider.verifyWebhook(rawBody, signature);
  } catch (e) {
    if (e instanceof WebhookSignatureError || e instanceof SyntaxError) throw invalid(`Webhook rejected: ${e.message}`);
    throw e;
  }

  let record = await WebhookEvent.findOne({ provider: provider.name, eventId: event.id }).lean();
  if (record?.processedAt) return { status: "duplicate" };
  if (!record) {
    try {
      const [created] = await WebhookEvent.create([{ provider: provider.name, eventId: event.id, type: event.type, payload: event, signatureValid: true }]);
      record = created.toObject();
    } catch (e) {
      if (isDuplicateKeyError(e)) return { status: "duplicate" };
      throw e;
    }
  }

  try {
    const result = await withTransaction((session) => applyEvent(session, event));
    await WebhookEvent.updateOne({ _id: record._id ?? toObjectId(record.id) }, { $set: { processedAt: new Date(), error: null } });
    return result;
  } catch (e) {
    await WebhookEvent.updateOne({ _id: record._id ?? toObjectId(record.id) }, { $set: { error: String(e?.message ?? e).slice(0, 500) } });
    throw e;
  }
}

async function applyEvent(session, event) {
  const txn = await PaymentTransaction.findOne({ providerRef: event.data.providerRef }).session(session).lean();
  if (!txn) return { status: "ignored", detail: "Unknown transaction reference." };
  const pm = await PaymentMilestone.findById(txn.paymentMilestoneId).session(session).lean();
  const order = await Order.findById(pm.orderId, { reference: 1, brandId: 1, manufacturerId: 1, projectId: 1 }).session(session).lean();
  const amount = new Decimal(String(txn.amount));
  if (!new Decimal(event.data.amount).equals(amount) || event.data.currency !== txn.currency) {
    throw new Error(`Amount mismatch for ${txn.providerRef}.`);
  }
  const link = `/orders/${idOf(order._id)}?tab=payments`;

  if (event.type === "payment.succeeded" || event.type === "payment.failed") {
    if (txn.type !== "CHARGE") return { status: "ignored", detail: "Event type does not match transaction." };
    const succeeded = event.type === "payment.succeeded";
    const moved = await PaymentTransaction.updateOne(
      { _id: txn._id, status: "PENDING" },
      { $set: { status: succeeded ? "SUCCEEDED" : "FAILED", failureReason: succeeded ? null : (event.data.reason ?? "Payment declined") } },
      { session },
    );
    if (!moved.modifiedCount) return { status: "ignored", detail: "Transaction already settled." };
    await PaymentMilestone.updateOne({ _id: pm._id }, { $set: succeeded ? { status: "PAID", paidAt: new Date() } : { status: "FAILED" } }, { session });
    const text = succeeded
      ? `${pm.label} payment of ${pm.currency} ${amount.toFixed(2)} for order ${order.reference} was received.`
      : `${pm.label} payment for order ${order.reference} failed: ${event.data.reason ?? "declined"}.`;
    await notify(session, [order.brandId, order.manufacturerId], "PAYMENT_UPDATE", succeeded ? "Payment received" : "Payment failed", text, link);
    await logActivity(session, { actorId: null, orderId: order._id, projectId: order.projectId, type: succeeded ? "PAYMENT_SUCCEEDED" : "PAYMENT_FAILED", message: text });
    return { status: "processed" };
  }

  if (event.type === "refund.succeeded") {
    if (txn.type !== "REFUND") return { status: "ignored", detail: "Event type does not match transaction." };
    const moved = await PaymentTransaction.updateOne({ _id: txn._id, status: "PENDING" }, { $set: { status: "SUCCEEDED" } }, { session });
    if (!moved.modifiedCount) return { status: "ignored", detail: "Refund already settled." };
    await PaymentMilestone.updateOne({ _id: pm._id }, { $set: { status: "REFUNDED" } }, { session });
    const text = `${pm.label} payment of ${pm.currency} ${amount.toFixed(2)} for order ${order.reference} was refunded.`;
    await notify(session, [order.brandId, order.manufacturerId], "PAYMENT_UPDATE", "Payment refunded", text, link);
    await logActivity(session, { actorId: null, orderId: order._id, projectId: order.projectId, type: "PAYMENT_REFUNDED", message: text });
    return { status: "processed" };
  }
  return { status: "ignored", detail: "Unhandled event type." };
}

/** Admin issues a refund for a paid milestone. Settles when the provider's refund webhook arrives. */
export async function requestRefund(actor, paymentMilestoneId, reason, provider = getPaymentProvider()) {
  assertRole(actor, "ADMIN");
  const id = toObjectId(paymentMilestoneId);
  const pm = id ? await PaymentMilestone.findById(id).lean() : null;
  if (!pm) throw notFound("Payment milestone");
  const transactions = await PaymentTransaction.find({ paymentMilestoneId: pm._id }).sort({ createdAt: 1, _id: 1 }).lean();
  if (pm.status !== "PAID") throw conflict("Only paid milestones can be refunded.");
  if (transactions.some((t) => t.type === "REFUND" && t.status === "PENDING")) throw conflict("A refund is already in progress.");
  const charge = transactions.find((t) => t.type === "CHARGE" && t.status === "SUCCEEDED");
  if (!charge) throw conflict("No successful charge was found for this milestone.");
  const amount = money(pm.amount, 2);
  const refund = await provider.createRefund({ amount, currency: pm.currency, paymentRef: charge.providerRef });
  await withTransaction(async (session) => {
    await PaymentTransaction.create(
      [{ paymentMilestoneId: pm._id, provider: provider.name, providerRef: refund.providerRef, type: "REFUND", amount, currency: pm.currency, initiatedById: toObjectId(actor.id) }],
      { session },
    );
    await audit(session, {
      actorId: actor.id,
      action: "PAYMENT_REFUND_REQUESTED",
      targetType: "PaymentMilestone",
      targetId: idOf(pm._id),
      reason,
      metadata: { amount, currency: pm.currency },
    });
  });
  return { providerRef: refund.providerRef, amount, currency: pm.currency };
}

/**
 * Brand changes the payment split. Allowed until any payment has started.
 * @param {{ label: string, percentage: number, triggerStage: string }[]} items
 */
export async function updatePaymentSchedule(actor, orderId, items) {
  assertRole(actor, "BRAND");
  await withTransaction(async (session) => {
    const id = toObjectId(orderId);
    const order = id ? await Order.findOne({ _id: id, brandId: toObjectId(actor.id) }).session(session).lean() : null;
    if (!order) throw notFound("Order");
    const paymentMilestones = await PaymentMilestone.find({ orderId: order._id }, { status: 1 }).session(session).lean();
    const milestones = await ProductionMilestone.find({ orderId: order._id }, { stage: 1, status: 1 }).session(session).lean();
    if (paymentMilestones.some((p) => ["PROCESSING", "PAID", "REFUNDED"].includes(p.status))) throw conflict("The schedule cannot change after a payment has started.");
    const stages = new Set(items.map((i) => i.triggerStage));
    if (stages.size !== items.length) throw invalid("Each payment must be tied to a different stage.");
    const amounts = allocateAmounts(String(order.totalAmount), items.map((i) => i.percentage));
    const sorted = items
      .map((it, i) => ({ ...it, amount: amounts[i] }))
      .sort((a, b) => STAGE_BY_KEY[a.triggerStage].sequence - STAGE_BY_KEY[b.triggerStage].sequence);
    const completed = new Set(milestones.filter((m) => m.status === "COMPLETED").map((m) => m.stage));
    await PaymentMilestone.deleteMany({ orderId: order._id }, { session });
    await PaymentMilestone.insertMany(
      sorted.map((it, i) => ({
        orderId: order._id,
        sequence: i + 1,
        label: it.label,
        percentage: it.percentage,
        amount: it.amount,
        currency: order.currency,
        triggerStage: it.triggerStage,
        status: completed.has(it.triggerStage) ? "DUE" : "SCHEDULED",
        dueAt: completed.has(it.triggerStage) ? new Date(Date.now() + 7 * DAY) : null,
      })),
      { session },
    );
    await logActivity(session, {
      actorId: actor.id,
      orderId: order._id,
      projectId: order.projectId,
      type: "PAYMENT_SCHEDULE_CHANGED",
      message: `Payment schedule updated: ${sorted.map((s) => `${s.label} ${s.percentage}%`).join(", ")}.`,
    });
    await notify(session, order.manufacturerId, "PAYMENT_UPDATE", "Payment schedule changed", `The brand updated the payment schedule for order ${order.reference}.`, `/orders/${idOf(order._id)}?tab=payments`);
  });
}

