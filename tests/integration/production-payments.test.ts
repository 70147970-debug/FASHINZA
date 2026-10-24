import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import type { MilestoneStage } from "@/generated/prisma/enums";
import { addEvidence, completeEvidenceStage, confirmDelivery, getOrder, postMessage, recordShipment, refreshDelays } from "@/server/services/orders";
import { decideQcReport, reviewSample, submitQcReport, submitSample } from "@/server/services/quality";
import { processPaymentWebhook, requestRefund, startPayment, updatePaymentSchedule } from "@/server/services/payments";
import { buildSandboxEvent } from "@/server/payments/provider";
import { raiseDispute, updateDispute } from "@/server/services/disputes";
import { makeBrand, makeOrder, pngFile, resetDb } from "../support/fixtures";
import type { Actor } from "@/server/actor";

beforeEach(resetDb);

const stageOf = async (orderId: string) => (await db.order.findUniqueOrThrow({ where: { id: orderId } })).currentStage;
const milestone = (orderId: string, stage: MilestoneStage) => db.productionMilestone.findUniqueOrThrow({ where: { orderId_stage: { orderId, stage } } });

async function completeWithEvidence(factory: Actor, orderId: string, stage: MilestoneStage) {
  await addEvidence(factory, orderId, stage, pngFile(`${stage}.png`));
  await completeEvidenceStage(factory, orderId, stage);
}

async function approveSample(factory: Actor, brand: Actor, orderId: string) {
  const s = await submitSample(factory, orderId, { description: "Pre-production sample in size M, black." }, [pngFile()]);
  await reviewSample(brand, s.id, "APPROVED");
}

async function toQualityControl(factory: Actor, brand: Actor, orderId: string) {
  await completeWithEvidence(factory, orderId, "FABRIC_SOURCING");
  await approveSample(factory, brand, orderId);
  for (const s of ["CUTTING", "STITCHING", "FINISHING"] as const) await completeWithEvidence(factory, orderId, s);
}

const QC = { inspectionDate: new Date(), batchSize: 500, sampleSize: 50, aqlMajor: 2.5, aqlMinor: 4.0, defects: [] as { category: string; severity: "CRITICAL" | "MAJOR" | "MINOR"; count: number }[] };

describe("production milestones", () => {
  it("enforces stage order, evidence and responsible party", async () => {
    const { brand, factory, order } = await makeOrder();
    // Cannot skip ahead or complete a gated stage manually.
    await expect(completeEvidenceStage(factory, order.id, "CUTTING")).rejects.toThrow(/not the current stage/);
    await expect(completeEvidenceStage(factory, order.id, "SAMPLING")).rejects.toThrow(/approves a sample/);
    // Evidence is required.
    await expect(completeEvidenceStage(factory, order.id, "FABRIC_SOURCING")).rejects.toThrow(/Upload evidence/);
    // Brands cannot complete manufacturer stages.
    await expect(completeEvidenceStage(brand, order.id, "FABRIC_SOURCING")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await completeWithEvidence(factory, order.id, "FABRIC_SOURCING");
    expect(await stageOf(order.id)).toBe("SAMPLING");
    expect((await milestone(order.id, "FABRIC_SOURCING")).status).toBe("COMPLETED");
    expect((await milestone(order.id, "SAMPLING")).status).toBe("IN_PROGRESS");
    expect(await db.notification.count({ where: { userId: brand.id, type: "MILESTONE_UPDATED" } })).toBe(1);
    // Completing the same stage twice is rejected.
    await expect(completeEvidenceStage(factory, order.id, "FABRIC_SOURCING")).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("runs sampling rounds until the brand approves, which makes the first payment due", async () => {
    const { brand, factory, order } = await makeOrder();
    await completeWithEvidence(factory, order.id, "FABRIC_SOURCING");
    await expect(submitSample(factory, order.id, { description: "Sample with photos missing" }, [])).rejects.toThrow(/photo/);
    const s1 = await submitSample(factory, order.id, { description: "First sample, size M." }, [pngFile()]);
    expect((await milestone(order.id, "SAMPLING")).status).toBe("AWAITING_APPROVAL");
    await expect(submitSample(factory, order.id, { description: "Another sample at once." }, [pngFile()])).rejects.toThrow(/already waiting/);
    await expect(reviewSample(brand, s1.id, "REVISION_REQUESTED")).rejects.toThrow(/Explain/);
    await reviewSample(brand, s1.id, "REVISION_REQUESTED", "Neck rib is too loose.");
    expect((await milestone(order.id, "SAMPLING")).status).toBe("IN_PROGRESS");
    await expect(reviewSample(brand, s1.id, "APPROVED")).rejects.toThrow(/already been reviewed/);

    const s2 = await submitSample(factory, order.id, { description: "Second sample with tighter rib.", revisionNotes: "Rib changed to 2x2" }, [pngFile()]);
    expect(s2.round).toBe(2);
    await reviewSample(brand, s2.id, "APPROVED");
    expect(await stageOf(order.id)).toBe("CUTTING");
    const p1 = await db.paymentMilestone.findFirstOrThrow({ where: { orderId: order.id, sequence: 1 } });
    expect(p1).toMatchObject({ status: "DUE", triggerStage: "SAMPLING" });
  });

  it("sends a failed batch back to stitching with a rework task and keeps the report", async () => {
    const { brand, factory, admin, order } = await makeOrder();
    await toQualityControl(factory, brand, order.id);
    expect(await stageOf(order.id)).toBe("QUALITY_CONTROL");
    // The sampling plan for 500 units at AQL 2.5 needs 50 units inspected.
    await expect(submitQcReport(factory, order.id, { ...QC, sampleSize: 20 }, [])).rejects.toThrow(/at least 50/);

    const failed = await submitQcReport(factory, order.id, { ...QC, defects: [{ category: "Stitching", severity: "MAJOR", count: 4 }], correctiveActions: "Re-stitch side seams" }, [pngFile()]);
    expect(failed).toMatchObject({ result: "FAIL", acceptMajor: 3, majorCount: 4, sampleSize: 50 });
    expect(await stageOf(order.id)).toBe("STITCHING");
    expect((await milestone(order.id, "STITCHING")).status).toBe("IN_PROGRESS");
    expect((await milestone(order.id, "FINISHING")).status).toBe("NOT_STARTED");
    expect((await milestone(order.id, "CUTTING")).status).toBe("COMPLETED");
    const rework = await db.reworkTask.findFirstOrThrow({ where: { orderId: order.id } });
    expect(rework).toMatchObject({ status: "OPEN", qcReportId: failed.id });
    expect(await db.notification.count({ where: { userId: admin.id, type: "QC_OUTCOME" } })).toBe(1);

    // Rework, re-inspect, pass, accept.
    await completeWithEvidence(factory, order.id, "STITCHING");
    await completeWithEvidence(factory, order.id, "FINISHING");
    const passed = await submitQcReport(factory, order.id, { ...QC, defects: [{ category: "Stitching", severity: "MAJOR", count: 1 }, { category: "Labelling", severity: "MINOR", count: 2 }] }, []);
    expect(passed.result).toBe("PASS");
    expect((await milestone(order.id, "QUALITY_CONTROL")).status).toBe("AWAITING_APPROVAL");
    await decideQcReport(brand, passed.id, "ACCEPTED");
    expect(await stageOf(order.id)).toBe("SHIPPING");
    expect((await db.reworkTask.findFirstOrThrow({ where: { orderId: order.id } })).status).toBe("COMPLETED");
    expect(await db.qCReport.count({ where: { orderId: order.id } })).toBe(2); // history preserved
    expect((await db.paymentMilestone.findFirstOrThrow({ where: { orderId: order.id, sequence: 2 } })).status).toBe("DUE");
  });

  it("treats a brand-rejected passing report as rework", async () => {
    const { brand, factory, order } = await makeOrder();
    await toQualityControl(factory, brand, order.id);
    const passed = await submitQcReport(factory, order.id, QC, []);
    await expect(decideQcReport(brand, passed.id, "REJECTED")).rejects.toThrow(/Explain/);
    await decideQcReport(brand, passed.id, "REJECTED", "Colour shade differs from the approved sample.");
    expect(await stageOf(order.id)).toBe("STITCHING");
    expect(await db.reworkTask.count({ where: { orderId: order.id, status: "OPEN" } })).toBe(1);
  });

  it("ships, confirms delivery and closes the order", async () => {
    const { brand, factory, order, projectId } = await makeOrder();
    await toQualityControl(factory, brand, order.id);
    const passed = await submitQcReport(factory, order.id, QC, []);
    await decideQcReport(brand, passed.id, "ACCEPTED");
    await expect(confirmDelivery(brand, order.id)).rejects.toThrow(/after the order has shipped/);
    await recordShipment(factory, order.id, "DHL Express", "1234567890");
    expect(await db.order.findUniqueOrThrow({ where: { id: order.id } })).toMatchObject({ status: "SHIPPED", currentStage: "DELIVERY", trackingInfo: "DHL Express · 1234567890" });
    await expect(confirmDelivery(factory, order.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await confirmDelivery(brand, order.id);
    const done = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(done.status).toBe("DELIVERED");
    expect(done.deliveredAt).not.toBeNull();
    expect((await db.project.findUniqueOrThrow({ where: { id: projectId } })).status).toBe("DELIVERED");
    expect(await db.paymentMilestone.count({ where: { orderId: order.id, status: "DUE" } })).toBe(3);
    expect(await db.notification.count({ where: { userId: factory.id, type: "ORDER_DELIVERED" } })).toBe(1);
  });

  it("flags overdue milestones once and notifies both parties", async () => {
    const { brand, factory, order } = await makeOrder();
    await db.productionMilestone.update({ where: { orderId_stage: { orderId: order.id, stage: "FABRIC_SOURCING" } }, data: { plannedEnd: new Date(Date.now() - 3 * 86400000) } });
    expect(await refreshDelays()).toBe(1);
    expect(await refreshDelays()).toBe(0);
    expect((await milestone(order.id, "FABRIC_SOURCING")).isDelayed).toBe(true);
    expect(await db.notification.count({ where: { type: "ORDER_DELAYED", userId: { in: [brand.id, factory.id] } } })).toBe(2);
  });

  it("limits order messages to participants", async () => {
    const { brand, factory, order } = await makeOrder();
    const outsider = await makeBrand();
    await postMessage(brand, order.id, "Please confirm the fabric arrival date.");
    await expect(postMessage(outsider, order.id, "Hello")).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await getOrder(factory, order.id)).messages).toHaveLength(1);
    expect(await db.notification.count({ where: { userId: factory.id, type: "MESSAGE_RECEIVED" } })).toBe(1);
  });
});

describe("sandbox payments", () => {
  async function dueOrder() {
    const ctx = await makeOrder();
    await completeWithEvidence(ctx.factory, ctx.order.id, "FABRIC_SOURCING");
    await approveSample(ctx.factory, ctx.brand, ctx.order.id);
    const pm = await db.paymentMilestone.findFirstOrThrow({ where: { orderId: ctx.order.id, sequence: 1 } });
    return { ...ctx, pm };
  }

  it("only marks a payment paid after a verified webhook, and only once", async () => {
    const { brand, factory, pm } = await dueOrder();
    const url = await startPayment(brand, pm.id);
    expect(url).toMatch(/^\/sandbox-checkout\/sbx_pay_/);
    expect((await db.paymentMilestone.findUniqueOrThrow({ where: { id: pm.id } })).status).toBe("PROCESSING");
    // Starting again returns the same checkout, not a second charge.
    expect(await startPayment(brand, pm.id)).toBe(url);
    expect(await db.paymentTransaction.count({ where: { paymentMilestoneId: pm.id } })).toBe(1);
    await expect(startPayment(factory, pm.id)).rejects.toMatchObject({ code: "FORBIDDEN" });

    const txn = await db.paymentTransaction.findFirstOrThrow({ where: { paymentMilestoneId: pm.id } });
    const { body, signature } = buildSandboxEvent("payment.succeeded", { providerRef: txn.providerRef, amount: txn.amount.toFixed(2), currency: txn.currency });

    await expect(processPaymentWebhook("sandbox", body, "t=1,v1=deadbeef")).rejects.toThrow(/rejected/);
    await expect(processPaymentWebhook("sandbox", body.replace(txn.amount.toFixed(2), "1.00"), signature)).rejects.toThrow(/rejected/);
    expect((await db.paymentMilestone.findUniqueOrThrow({ where: { id: pm.id } })).status).toBe("PROCESSING");

    expect(await processPaymentWebhook("sandbox", body, signature)).toEqual({ status: "processed" });
    expect(await processPaymentWebhook("sandbox", body, signature)).toEqual({ status: "duplicate" });
    expect((await db.paymentMilestone.findUniqueOrThrow({ where: { id: pm.id } })).status).toBe("PAID");
    expect(await db.webhookEvent.count()).toBe(1);
    expect(await db.notification.count({ where: { userId: factory.id, title: "Payment received" } })).toBe(1);
    await expect(startPayment(brand, pm.id)).rejects.toThrow(/already paid/);
  });

  it("handles declined payments and allows a retry", async () => {
    const { brand, pm } = await dueOrder();
    await startPayment(brand, pm.id);
    const txn = await db.paymentTransaction.findFirstOrThrow({ where: { paymentMilestoneId: pm.id } });
    const failed = buildSandboxEvent("payment.failed", { providerRef: txn.providerRef, amount: txn.amount.toFixed(2), currency: txn.currency, reason: "Card declined" });
    await processPaymentWebhook("sandbox", failed.body, failed.signature);
    expect((await db.paymentMilestone.findUniqueOrThrow({ where: { id: pm.id } })).status).toBe("FAILED");
    // A late "succeeded" for the already-failed transaction is ignored.
    const late = buildSandboxEvent("payment.succeeded", { providerRef: txn.providerRef, amount: txn.amount.toFixed(2), currency: txn.currency });
    expect(await processPaymentWebhook("sandbox", late.body, late.signature)).toMatchObject({ status: "ignored" });
    await startPayment(brand, pm.id);
    expect(await db.paymentTransaction.count({ where: { paymentMilestoneId: pm.id } })).toBe(2);
  });

  it("records refunds through the provider webhook with an audit entry", async () => {
    const { brand, admin, pm } = await dueOrder();
    await startPayment(brand, pm.id);
    const charge = await db.paymentTransaction.findFirstOrThrow({ where: { paymentMilestoneId: pm.id } });
    const ok = buildSandboxEvent("payment.succeeded", { providerRef: charge.providerRef, amount: charge.amount.toFixed(2), currency: charge.currency });
    await processPaymentWebhook("sandbox", ok.body, ok.signature);
    await expect(requestRefund(brand, pm.id, "Duplicate charge")).rejects.toMatchObject({ code: "FORBIDDEN" });
    const refund = await requestRefund(admin, pm.id, "Order cancelled by agreement");
    const ev = buildSandboxEvent("refund.succeeded", { providerRef: refund.providerRef, amount: refund.amount, currency: refund.currency });
    await processPaymentWebhook("sandbox", ev.body, ev.signature);
    expect((await db.paymentMilestone.findUniqueOrThrow({ where: { id: pm.id } })).status).toBe("REFUNDED");
    expect(await db.auditLog.count({ where: { action: "PAYMENT_REFUND_REQUESTED", targetId: pm.id } })).toBe(1);
  });

  it("lets the brand change the split before any payment starts", async () => {
    const { brand, order } = await makeOrder();
    await expect(updatePaymentSchedule(brand, order.id, [{ label: "Deposit", percentage: 50, triggerStage: "SAMPLING" }, { label: "Balance", percentage: 40, triggerStage: "DELIVERY" }])).rejects.toThrow(/100/);
    await updatePaymentSchedule(brand, order.id, [
      { label: "Balance", percentage: 50, triggerStage: "DELIVERY" },
      { label: "Deposit", percentage: 50, triggerStage: "FABRIC_SOURCING" },
    ]);
    const rows = await db.paymentMilestone.findMany({ where: { orderId: order.id }, orderBy: { sequence: "asc" } });
    expect(rows.map((r) => [r.label, r.amount.toFixed(2)])).toEqual([["Deposit", "1660.25"], ["Balance", "1660.25"]]);
  });
});

describe("disputes", () => {
  it("lets order participants raise disputes and admins resolve them with an audit trail", async () => {
    const { brand, factory, admin, order } = await makeOrder();
    const outsider = await makeBrand();
    await expect(raiseDispute(outsider, { orderId: order.id, category: "QUALITY", subject: "Not my order", description: "Trying to raise a dispute on someone else's order." })).rejects.toMatchObject({ code: "NOT_FOUND" });
    const issue = await raiseDispute(brand, { orderId: order.id, category: "DELIVERY", subject: "Fabric delayed", description: "Fabric sourcing is two weeks behind the plan without explanation." });
    expect(await db.notification.count({ where: { userId: factory.id, type: "DISPUTE_UPDATE" } })).toBe(1);
    expect(await db.notification.count({ where: { userId: admin.id, type: "DISPUTE_UPDATE" } })).toBe(1);
    await expect(updateDispute(brand, issue.id, { status: "RESOLVED", resolution: "self-resolved" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await updateDispute(admin, issue.id, { status: "RESOLVED", resolution: "Factory agreed a new fabric date; delivery date extended by 10 days." });
    expect(await db.issueReport.findUniqueOrThrow({ where: { id: issue.id } })).toMatchObject({ status: "RESOLVED" });
    expect(await db.auditLog.count({ where: { targetId: issue.id } })).toBe(1);
  });
});
