/**
 * Port of tests/integration/production-payments.test.ts (same case names) plus the SERVER-B parts of
 * tests/integration/auth-access.test.ts (notifications, admin-only decisions, order isolation).
 * Runs the real services against MongoDB (database name must contain "test").
 */
import { beforeEach, describe, expect, it } from "vitest";
import { addEvidence, completeEvidenceStage, confirmDelivery, getOrder, listOrders, postMessage, recordShipment, refreshDelays } from "../../src/services/orders.js";
import { decideQcReport, reviewSample, submitQcReport, submitSample } from "../../src/services/quality.js";
import { processPaymentWebhook, requestRefund, startPayment, updatePaymentSchedule } from "../../src/services/payments.js";
import { buildSandboxEvent } from "../../src/payments/provider.js";
import { raiseDispute, updateDispute } from "../../src/services/disputes.js";
import { listNotifications, markRead } from "../../src/services/notifications.js";
import { decideVerification, setUserStatus } from "../../src/services/admin.js";
import { AuditLog, IssueReport, ManufacturerProfile, Notification, Order, PaymentMilestone, PaymentTransaction, ProductionMilestone, Project, QCReport, ReworkTask, WebhookEvent } from "../../src/models/index.js";
import { idOf } from "../../src/lib/ids.js";
import { makeAdmin, makeBrand, makeFactory, makeOrder, pngFile, resetDb } from "../support/fixtures.js";

beforeEach(resetDb);

const orderIdOf = (ctx) => idOf(ctx.order);
const stageOf = async (orderId) => (await Order.findById(orderId).orFail().lean()).currentStage;
const milestone = (orderId, stage) => ProductionMilestone.findOne({ orderId, stage }).orFail().lean();
const countNotes = (filter) => Notification.countDocuments(filter);

async function completeWithEvidence(factory, orderId, stage) {
  await addEvidence(factory, orderId, stage, pngFile(`${stage}.png`));
  await completeEvidenceStage(factory, orderId, stage);
}

async function approveSample(factory, brand, orderId) {
  const s = await submitSample(factory, orderId, { description: "Pre-production sample in size M, black." }, [pngFile()]);
  await reviewSample(brand, s.id, "APPROVED");
}

async function toQualityControl(factory, brand, orderId) {
  await completeWithEvidence(factory, orderId, "FABRIC_SOURCING");
  await approveSample(factory, brand, orderId);
  for (const s of ["CUTTING", "STITCHING", "FINISHING"]) await completeWithEvidence(factory, orderId, s);
}

const QC = { inspectionDate: new Date(), batchSize: 500, sampleSize: 50, aqlMajor: 2.5, aqlMinor: 4.0, defects: [] };

describe("production milestones", () => {
  it("enforces stage order, evidence and responsible party", async () => {
    const ctx = await makeOrder();
    const { brand, factory } = ctx;
    const orderId = orderIdOf(ctx);
    // Cannot skip ahead or complete a gated stage manually.
    await expect(completeEvidenceStage(factory, orderId, "CUTTING")).rejects.toThrow(/not the current stage/);
    await expect(completeEvidenceStage(factory, orderId, "SAMPLING")).rejects.toThrow(/approves a sample/);
    // Evidence is required.
    await expect(completeEvidenceStage(factory, orderId, "FABRIC_SOURCING")).rejects.toThrow(/Upload evidence/);
    // Brands cannot complete manufacturer stages.
    await expect(completeEvidenceStage(brand, orderId, "FABRIC_SOURCING")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await completeWithEvidence(factory, orderId, "FABRIC_SOURCING");
    expect(await stageOf(orderId)).toBe("SAMPLING");
    expect((await milestone(orderId, "FABRIC_SOURCING")).status).toBe("COMPLETED");
    expect((await milestone(orderId, "SAMPLING")).status).toBe("IN_PROGRESS");
    expect(await countNotes({ userId: brand.id, type: "MILESTONE_UPDATED" })).toBe(1);
    // Completing the same stage twice is rejected.
    await expect(completeEvidenceStage(factory, orderId, "FABRIC_SOURCING")).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("runs sampling rounds until the brand approves, which makes the first payment due", async () => {
    const ctx = await makeOrder();
    const { brand, factory } = ctx;
    const orderId = orderIdOf(ctx);
    await completeWithEvidence(factory, orderId, "FABRIC_SOURCING");
    await expect(submitSample(factory, orderId, { description: "Sample with photos missing" }, [])).rejects.toThrow(/photo/);
    const s1 = await submitSample(factory, orderId, { description: "First sample, size M." }, [pngFile()]);
    expect((await milestone(orderId, "SAMPLING")).status).toBe("AWAITING_APPROVAL");
    await expect(submitSample(factory, orderId, { description: "Another sample at once." }, [pngFile()])).rejects.toThrow(/already waiting/);
    await expect(reviewSample(brand, s1.id, "REVISION_REQUESTED")).rejects.toThrow(/Explain/);
    await reviewSample(brand, s1.id, "REVISION_REQUESTED", "Neck rib is too loose.");
    expect((await milestone(orderId, "SAMPLING")).status).toBe("IN_PROGRESS");
    await expect(reviewSample(brand, s1.id, "APPROVED")).rejects.toThrow(/already been reviewed/);

    const s2 = await submitSample(factory, orderId, { description: "Second sample with tighter rib.", revisionNotes: "Rib changed to 2x2" }, [pngFile()]);
    expect(s2.round).toBe(2);
    await reviewSample(brand, s2.id, "APPROVED");
    expect(await stageOf(orderId)).toBe("CUTTING");
    const p1 = await PaymentMilestone.findOne({ orderId, sequence: 1 }).orFail();
    expect(p1.toJSON()).toMatchObject({ status: "DUE", triggerStage: "SAMPLING" });
  });

  it("sends a failed batch back to stitching with a rework task and keeps the report", async () => {
    const ctx = await makeOrder();
    const { brand, factory, admin } = ctx;
    const orderId = orderIdOf(ctx);
    await toQualityControl(factory, brand, orderId);
    expect(await stageOf(orderId)).toBe("QUALITY_CONTROL");
    // The sampling plan for 500 units at AQL 2.5 needs 50 units inspected.
    await expect(submitQcReport(factory, orderId, { ...QC, sampleSize: 20 }, [])).rejects.toThrow(/at least 50/);

    const failed = await submitQcReport(factory, orderId, { ...QC, defects: [{ category: "Stitching", severity: "MAJOR", count: 4 }], correctiveActions: "Re-stitch side seams" }, [pngFile()]);
    expect(failed).toMatchObject({ result: "FAIL", acceptMajor: 3, majorCount: 4, sampleSize: 50, defectRate: "8.00", aqlMajor: "2.50" });
    expect(await stageOf(orderId)).toBe("STITCHING");
    expect((await milestone(orderId, "STITCHING")).status).toBe("IN_PROGRESS");
    expect((await milestone(orderId, "FINISHING")).status).toBe("NOT_STARTED");
    expect((await milestone(orderId, "CUTTING")).status).toBe("COMPLETED");
    const rework = await ReworkTask.findOne({ orderId }).orFail();
    expect(rework.toJSON()).toMatchObject({ status: "OPEN", qcReportId: failed.id });
    expect(await countNotes({ userId: admin.id, type: "QC_OUTCOME" })).toBe(1);

    // Rework, re-inspect, pass, accept.
    await completeWithEvidence(factory, orderId, "STITCHING");
    await completeWithEvidence(factory, orderId, "FINISHING");
    const passed = await submitQcReport(
      factory,
      orderId,
      { ...QC, defects: [{ category: "Stitching", severity: "MAJOR", count: 1 }, { category: "Labelling", severity: "MINOR", count: 2 }] },
      [],
    );
    expect(passed.result).toBe("PASS");
    expect((await milestone(orderId, "QUALITY_CONTROL")).status).toBe("AWAITING_APPROVAL");
    await decideQcReport(brand, passed.id, "ACCEPTED");
    expect(await stageOf(orderId)).toBe("SHIPPING");
    expect((await ReworkTask.findOne({ orderId }).orFail()).status).toBe("COMPLETED");
    expect(await QCReport.countDocuments({ orderId })).toBe(2); // history preserved
    expect((await PaymentMilestone.findOne({ orderId, sequence: 2 }).orFail()).status).toBe("DUE");
  });

  it("treats a brand-rejected passing report as rework", async () => {
    const ctx = await makeOrder();
    const { brand, factory } = ctx;
    const orderId = orderIdOf(ctx);
    await toQualityControl(factory, brand, orderId);
    const passed = await submitQcReport(factory, orderId, QC, []);
    await expect(decideQcReport(brand, passed.id, "REJECTED")).rejects.toThrow(/Explain/);
    await decideQcReport(brand, passed.id, "REJECTED", "Colour shade differs from the approved sample.");
    expect(await stageOf(orderId)).toBe("STITCHING");
    expect(await ReworkTask.countDocuments({ orderId, status: "OPEN" })).toBe(1);
  });

  it("ships, confirms delivery and closes the order", async () => {
    const ctx = await makeOrder();
    const { brand, factory, projectId } = ctx;
    const orderId = orderIdOf(ctx);
    await toQualityControl(factory, brand, orderId);
    const passed = await submitQcReport(factory, orderId, QC, []);
    await decideQcReport(brand, passed.id, "ACCEPTED");
    await expect(confirmDelivery(brand, orderId)).rejects.toThrow(/after the order has shipped/);
    await recordShipment(factory, orderId, "DHL Express", "1234567890");
    expect(await Order.findById(orderId).orFail().lean()).toMatchObject({ status: "SHIPPED", currentStage: "DELIVERY", trackingInfo: "DHL Express · 1234567890" });
    await expect(confirmDelivery(factory, orderId)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await confirmDelivery(brand, orderId);
    const done = await Order.findById(orderId).orFail().lean();
    expect(done.status).toBe("DELIVERED");
    expect(done.deliveredAt).not.toBeNull();
    expect((await Project.findById(projectId).orFail().lean()).status).toBe("DELIVERED");
    expect(await PaymentMilestone.countDocuments({ orderId, status: "DUE" })).toBe(3);
    expect(await countNotes({ userId: factory.id, type: "ORDER_DELIVERED" })).toBe(1);
  });

  it("flags overdue milestones once and notifies both parties", async () => {
    const ctx = await makeOrder();
    const { brand, factory } = ctx;
    const orderId = orderIdOf(ctx);
    await ProductionMilestone.updateOne({ orderId, stage: "FABRIC_SOURCING" }, { $set: { plannedEnd: new Date(Date.now() - 3 * 86400000) } });
    expect(await refreshDelays()).toBe(1);
    expect(await refreshDelays()).toBe(0);
    expect((await milestone(orderId, "FABRIC_SOURCING")).isDelayed).toBe(true);
    expect(await countNotes({ type: "ORDER_DELAYED", userId: { $in: [brand.id, factory.id] } })).toBe(2);
    expect((await listOrders(brand, { delayed: true })).total).toBe(1);
  });

  it("limits order messages to participants", async () => {
    const ctx = await makeOrder();
    const { brand, factory } = ctx;
    const orderId = orderIdOf(ctx);
    const outsider = await makeBrand();
    await postMessage(brand, orderId, "Please confirm the fabric arrival date.");
    await expect(postMessage(outsider, orderId, "Hello")).rejects.toMatchObject({ code: "NOT_FOUND" });
    const order = await getOrder(factory, orderId);
    expect(order.messages).toHaveLength(1);
    expect(order.messages[0].author).toEqual({ name: brand.name, role: "BRAND" });
    expect(await countNotes({ userId: factory.id, type: "MESSAGE_RECEIVED" })).toBe(1);
  });
});

describe("sandbox payments", () => {
  async function dueOrder() {
    const ctx = await makeOrder();
    const orderId = orderIdOf(ctx);
    await completeWithEvidence(ctx.factory, orderId, "FABRIC_SOURCING");
    await approveSample(ctx.factory, ctx.brand, orderId);
    const pm = await PaymentMilestone.findOne({ orderId, sequence: 1 }).orFail();
    return { ...ctx, orderId, pm: pm.toJSON() };
  }

  it("only marks a payment paid after a verified webhook, and only once", async () => {
    const { brand, factory, pm } = await dueOrder();
    const url = await startPayment(brand, pm.id);
    expect(url).toMatch(/^\/sandbox-checkout\/sbx_pay_/);
    expect((await PaymentMilestone.findById(pm.id).orFail()).status).toBe("PROCESSING");
    // Starting again returns the same checkout, not a second charge.
    expect(await startPayment(brand, pm.id)).toBe(url);
    expect(await PaymentTransaction.countDocuments({ paymentMilestoneId: pm.id })).toBe(1);
    await expect(startPayment(factory, pm.id)).rejects.toMatchObject({ code: "FORBIDDEN" });

    const txn = (await PaymentTransaction.findOne({ paymentMilestoneId: pm.id }).orFail()).toJSON();
    const { body, signature } = buildSandboxEvent("payment.succeeded", { providerRef: txn.providerRef, amount: txn.amount, currency: txn.currency });

    await expect(processPaymentWebhook("sandbox", body, "t=1,v1=deadbeef")).rejects.toThrow(/rejected/);
    await expect(processPaymentWebhook("sandbox", body.replace(txn.amount, "1.00"), signature)).rejects.toThrow(/rejected/);
    expect((await PaymentMilestone.findById(pm.id).orFail()).status).toBe("PROCESSING");

    expect(await processPaymentWebhook("sandbox", body, signature)).toEqual({ status: "processed" });
    expect(await processPaymentWebhook("sandbox", body, signature)).toEqual({ status: "duplicate" });
    expect((await PaymentMilestone.findById(pm.id).orFail()).status).toBe("PAID");
    expect(await WebhookEvent.countDocuments()).toBe(1);
    expect(await countNotes({ userId: factory.id, title: "Payment received" })).toBe(1);
    await expect(startPayment(brand, pm.id)).rejects.toThrow(/already paid/);
  });

  it("handles declined payments and allows a retry", async () => {
    const { brand, pm } = await dueOrder();
    await startPayment(brand, pm.id);
    const txn = (await PaymentTransaction.findOne({ paymentMilestoneId: pm.id }).orFail()).toJSON();
    const failed = buildSandboxEvent("payment.failed", { providerRef: txn.providerRef, amount: txn.amount, currency: txn.currency, reason: "Card declined" });
    await processPaymentWebhook("sandbox", failed.body, failed.signature);
    expect((await PaymentMilestone.findById(pm.id).orFail()).status).toBe("FAILED");
    // A late "succeeded" for the already-failed transaction is ignored.
    const late = buildSandboxEvent("payment.succeeded", { providerRef: txn.providerRef, amount: txn.amount, currency: txn.currency });
    expect(await processPaymentWebhook("sandbox", late.body, late.signature)).toMatchObject({ status: "ignored" });
    await startPayment(brand, pm.id);
    expect(await PaymentTransaction.countDocuments({ paymentMilestoneId: pm.id })).toBe(2);
  });

  it("records refunds through the provider webhook with an audit entry", async () => {
    const { brand, admin, pm } = await dueOrder();
    await startPayment(brand, pm.id);
    const charge = (await PaymentTransaction.findOne({ paymentMilestoneId: pm.id }).orFail()).toJSON();
    const ok = buildSandboxEvent("payment.succeeded", { providerRef: charge.providerRef, amount: charge.amount, currency: charge.currency });
    await processPaymentWebhook("sandbox", ok.body, ok.signature);
    await expect(requestRefund(brand, pm.id, "Duplicate charge")).rejects.toMatchObject({ code: "FORBIDDEN" });
    const refund = await requestRefund(admin, pm.id, "Order cancelled by agreement");
    const ev = buildSandboxEvent("refund.succeeded", { providerRef: refund.providerRef, amount: refund.amount, currency: refund.currency });
    await processPaymentWebhook("sandbox", ev.body, ev.signature);
    expect((await PaymentMilestone.findById(pm.id).orFail()).status).toBe("REFUNDED");
    expect(await AuditLog.countDocuments({ action: "PAYMENT_REFUND_REQUESTED", targetId: pm.id })).toBe(1);
  });

  it("lets the brand change the split before any payment starts", async () => {
    const ctx = await makeOrder();
    const { brand } = ctx;
    const orderId = orderIdOf(ctx);
    await expect(
      updatePaymentSchedule(brand, orderId, [
        { label: "Deposit", percentage: 50, triggerStage: "SAMPLING" },
        { label: "Balance", percentage: 40, triggerStage: "DELIVERY" },
      ]),
    ).rejects.toThrow(/100/);
    await updatePaymentSchedule(brand, orderId, [
      { label: "Balance", percentage: 50, triggerStage: "DELIVERY" },
      { label: "Deposit", percentage: 50, triggerStage: "FABRIC_SOURCING" },
    ]);
    const rows = await PaymentMilestone.find({ orderId }).sort({ sequence: 1 });
    expect(rows.map((r) => [r.label, r.toJSON().amount])).toEqual([
      ["Deposit", "1660.25"],
      ["Balance", "1660.25"],
    ]);
  });
});

describe("disputes", () => {
  it("lets order participants raise disputes and admins resolve them with an audit trail", async () => {
    const ctx = await makeOrder();
    const { brand, factory, admin } = ctx;
    const orderId = orderIdOf(ctx);
    const outsider = await makeBrand();
    await expect(
      raiseDispute(outsider, { orderId, category: "QUALITY", subject: "Not my order", description: "Trying to raise a dispute on someone else's order." }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    const issue = await raiseDispute(brand, { orderId, category: "DELIVERY", subject: "Fabric delayed", description: "Fabric sourcing is two weeks behind the plan without explanation." });
    expect(await countNotes({ userId: factory.id, type: "DISPUTE_UPDATE" })).toBe(1);
    expect(await countNotes({ userId: admin.id, type: "DISPUTE_UPDATE" })).toBe(1);
    await expect(updateDispute(brand, issue.id, { status: "RESOLVED", resolution: "self-resolved" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await updateDispute(admin, issue.id, { status: "RESOLVED", resolution: "Factory agreed a new fabric date; delivery date extended by 10 days." });
    expect(await IssueReport.findById(issue.id).orFail().lean()).toMatchObject({ status: "RESOLVED" });
    expect(await AuditLog.countDocuments({ targetId: issue.id })).toBe(1);
  });
});

describe("role permissions (admin decisions)", () => {
  it("rejects admin-only operations from other roles", async () => {
    const admin = await makeAdmin();
    const factory = await makeFactory(admin);
    const brand = await makeBrand();
    await expect(setUserStatus(brand, factory.id, "SUSPENDED", "not allowed")).rejects.toMatchObject({ code: "FORBIDDEN" });
    const profile = await ManufacturerProfile.findOne({ userId: factory.id }).orFail().lean();
    await expect(decideVerification(brand, idOf(profile._id), "VERIFIED", "self-approve")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("tenant isolation (orders, notifications)", () => {
  it("keeps orders private to their organisations", async () => {
    const ctx = await makeOrder();
    const orderId = orderIdOf(ctx);
    const otherBrand = await makeBrand();
    const admin = await makeAdmin();
    const outsiderFactory = await makeFactory(admin, { categories: ["DENIM"] });
    await expect(getOrder(otherBrand, orderId)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(getOrder(outsiderFactory, orderId)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(getOrder(otherBrand, "not-an-id")).rejects.toMatchObject({ code: "NOT_FOUND", message: "Order was not found or you do not have access to it." });
    expect((await listOrders(outsiderFactory)).total).toBe(0);
    expect((await getOrder(admin, orderId)).id).toBe(orderId);
    expect((await listOrders(ctx.brand)).total).toBe(1);
  });

  it("only marks the caller's own notifications as read", async () => {
    const a = await makeBrand();
    const b = await makeBrand();
    const bNotes = await listNotifications(b);
    await markRead(a, bNotes.items.map((n) => n.id));
    expect((await listNotifications(b, { unread: true })).total).toBe(bNotes.total);
    await markRead(b, "all");
    expect((await listNotifications(b, { unread: true })).total).toBe(0);
  });
});
