import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { MilestoneStage, OrderStatus, ProjectStatus } from "@/generated/prisma/enums";
import { allocateAmounts } from "@/lib/quotation-math";
import { DEFAULT_PAYMENT_SCHEDULE, nextStage, PAYMENT_DUE_DAYS, planMilestoneDates, REWORK_STAGE, STAGE_BY_KEY, STAGES, stageLabel } from "@/lib/workflow";
import type { Actor } from "@/server/actor";
import { assertRole, orderScope } from "@/server/access";
import { conflict, invalid, notFound } from "@/server/errors";
import { logActivity, notify, notifyAdmins } from "@/server/events";
import { saveUpload, deleteStoredFile } from "@/server/storage";

type Tx = Prisma.TransactionClient;
const DAY = 24 * 60 * 60 * 1000;

export function orderReference() {
  return `FZ-${new Date().getUTCFullYear()}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

/** Creates the order, its milestone plan and its payment schedule from an accepted quotation. */
export async function createOrderFromQuotation(tx: Tx, quotationId: string, actorId: string) {
  const q = await tx.quotation.findUniqueOrThrow({ where: { id: quotationId }, include: { project: true } });
  const now = new Date();
  const expected = new Date(now.getTime() + q.productionDays * DAY);
  const order = await tx.order.create({
    data: {
      reference: orderReference(),
      projectId: q.projectId,
      quotationId: q.id,
      brandId: q.project.brandId,
      manufacturerId: q.manufacturerId,
      quantity: q.quantity,
      unitPrice: q.quantity ? q.totalAmount.dividedBy(q.quantity).toDecimalPlaces(2) : q.unitPrice,
      totalAmount: q.totalAmount,
      currency: q.currency,
      expectedCompletionDate: expected,
      currentStage: STAGES[0].stage,
      agreedTerms: {
        quotationVersion: q.version,
        quantity: q.quantity,
        minQuantity: q.minQuantity,
        productionDays: q.productionDays,
        unitPrice: q.unitPrice.toFixed(2),
        fabricCostPerUnit: q.fabricCostPerUnit.toFixed(2),
        finishingCostPerUnit: q.finishingCostPerUnit.toFixed(2),
        packagingCostPerUnit: q.packagingCostPerUnit.toFixed(2),
        samplingCost: q.samplingCost?.toFixed(2) ?? "0.00",
        logisticsCost: q.logisticsCost.toFixed(2),
        taxPercent: q.taxPercent.toFixed(2),
        subtotal: q.subtotal.toFixed(2),
        taxAmount: q.taxAmount.toFixed(2),
        totalAmount: q.totalAmount.toFixed(2),
        currency: q.currency,
        notes: q.notes,
      },
    },
  });
  const plan = planMilestoneDates(now, q.productionDays);
  await tx.productionMilestone.createMany({
    data: STAGES.map((s, i) => ({
      orderId: order.id,
      stage: s.stage,
      sequence: i + 1,
      responsibleParty: s.party,
      evidenceRequired: s.gate === "evidence",
      plannedStart: plan[i].plannedStart,
      plannedEnd: plan[i].plannedEnd,
      status: i === 0 ? "IN_PROGRESS" : "NOT_STARTED",
      startedAt: i === 0 ? now : null,
    })),
  });
  const amounts = allocateAmounts(q.totalAmount.toString(), DEFAULT_PAYMENT_SCHEDULE.map((p) => p.percentage));
  await tx.paymentMilestone.createMany({
    data: DEFAULT_PAYMENT_SCHEDULE.map((p, i) => ({
      orderId: order.id,
      sequence: i + 1,
      label: p.label,
      percentage: p.percentage,
      amount: amounts[i],
      currency: q.currency,
      triggerStage: p.triggerStage,
    })),
  });
  await logActivity(tx, { actorId, orderId: order.id, projectId: q.projectId, type: "ORDER_CREATED", message: `Order ${order.reference} created from quotation version ${q.version}.` });
  return order;
}

export async function loadOrder(tx: Tx | typeof db, actor: Actor, orderId: string) {
  const order = await tx.order.findFirst({ where: { id: orderId, ...orderScope(actor) }, include: { project: { select: { name: true } } } });
  if (!order) throw notFound("Order");
  return order;
}

function assertParty(actor: Actor, order: { brandId: string; manufacturerId: string }, party: "BRAND" | "MANUFACTURER") {
  const ok = party === "BRAND" ? actor.id === order.brandId : actor.id === order.manufacturerId;
  if (!ok) throw invalid(party === "BRAND" ? "Only the brand that placed this order can do this." : "Only the manufacturer producing this order can do this.");
}

const STATUS_FOR_STAGE: Record<MilestoneStage, { order: OrderStatus; project: ProjectStatus }> = {
  FABRIC_SOURCING: { order: "IN_PRODUCTION", project: "IN_PRODUCTION" },
  SAMPLING: { order: "IN_PRODUCTION", project: "IN_PRODUCTION" },
  CUTTING: { order: "IN_PRODUCTION", project: "IN_PRODUCTION" },
  STITCHING: { order: "IN_PRODUCTION", project: "IN_PRODUCTION" },
  FINISHING: { order: "IN_PRODUCTION", project: "IN_PRODUCTION" },
  QUALITY_CONTROL: { order: "QUALITY_CHECK", project: "QUALITY_CHECK" },
  SHIPPING: { order: "READY_TO_SHIP", project: "READY_TO_SHIP" },
  DELIVERY: { order: "SHIPPED", project: "SHIPPED" },
};

/**
 * The only way a milestone is completed. Requires the stage to be the order's current stage,
 * marks it complete, starts the next stage, updates order/project status and makes any payment
 * milestone tied to the stage due. Stages can never be skipped.
 */
export async function completeStage(tx: Tx, orderId: string, stage: MilestoneStage, actorId: string, note?: string) {
  const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { project: { select: { name: true, id: true } } } });
  if (order.status === "CANCELLED" || order.status === "DELIVERED") throw conflict("This order is closed.");
  if (order.currentStage !== stage) throw conflict(`${stageLabel(stage)} is not the current stage. Current stage: ${stageLabel(order.currentStage)}.`);
  const milestone = await tx.productionMilestone.findUniqueOrThrow({ where: { orderId_stage: { orderId, stage } } });
  if (milestone.status === "COMPLETED") throw conflict(`${stageLabel(stage)} is already complete.`);
  const now = new Date();
  // Conditional update guards against two concurrent completions.
  const done = await tx.productionMilestone.updateMany({
    where: { id: milestone.id, status: { in: ["IN_PROGRESS", "AWAITING_APPROVAL"] } },
    data: { status: "COMPLETED", completedAt: now, responsibleUserId: actorId, notes: note ?? milestone.notes, isDelayed: milestone.plannedEnd ? now > milestone.plannedEnd : false },
  });
  if (!done.count) throw conflict(`${stageLabel(stage)} cannot be completed from its current state.`);

  const next = nextStage(stage);
  if (next) {
    await tx.productionMilestone.update({ where: { orderId_stage: { orderId, stage: next } }, data: { status: "IN_PROGRESS", startedAt: now } });
    const s = STATUS_FOR_STAGE[next];
    await tx.order.update({ where: { id: orderId }, data: { currentStage: next, status: s.order } });
    await tx.project.update({ where: { id: order.projectId }, data: { status: s.project } });
  } else {
    await tx.order.update({ where: { id: orderId }, data: { status: "DELIVERED", deliveredAt: now } });
    await tx.project.update({ where: { id: order.projectId }, data: { status: "DELIVERED" } });
  }

  const due = await tx.paymentMilestone.findMany({ where: { orderId, triggerStage: stage, status: "SCHEDULED" } });
  for (const p of due) {
    await tx.paymentMilestone.update({ where: { id: p.id }, data: { status: "DUE", dueAt: new Date(now.getTime() + PAYMENT_DUE_DAYS * DAY) } });
    await notify(tx, order.brandId, "PAYMENT_UPDATE", "Payment milestone due", `${p.label} (${p.percentage.toString()}%) for order ${order.reference} is now due.`, `/orders/${orderId}#payments`);
    await notify(tx, order.manufacturerId, "PAYMENT_UPDATE", "Payment milestone due", `${p.label} for order ${order.reference} is now due from the brand.`, `/orders/${orderId}#payments`);
  }

  await logActivity(tx, { actorId, orderId, projectId: order.projectId, type: "MILESTONE_COMPLETED", message: `${stageLabel(stage)} completed.${next ? ` ${stageLabel(next)} started.` : " Order delivered."}` });
  const recipients = [order.brandId, order.manufacturerId].filter((id) => id !== actorId);
  if (recipients.length) {
    await notify(
      tx,
      recipients,
      next ? "MILESTONE_UPDATED" : "ORDER_DELIVERED",
      next ? `${stageLabel(stage)} complete` : "Delivery confirmed",
      next ? `Order ${order.reference} (${order.project.name}) moved to ${stageLabel(next)}.` : `Order ${order.reference} (${order.project.name}) has been delivered.`,
      `/orders/${orderId}`,
    );
  }
}

/** Sends production back to the rework stage after a failed or rejected inspection. */
export async function rollbackForRework(tx: Tx, orderId: string) {
  const now = new Date();
  const reworkSeq = STAGE_BY_KEY[REWORK_STAGE].sequence;
  const qcSeq = STAGE_BY_KEY.QUALITY_CONTROL.sequence;
  await tx.productionMilestone.update({ where: { orderId_stage: { orderId, stage: REWORK_STAGE } }, data: { status: "IN_PROGRESS", startedAt: now, completedAt: null } });
  await tx.productionMilestone.updateMany({
    where: { orderId, sequence: { gt: reworkSeq, lte: qcSeq } },
    data: { status: "NOT_STARTED", startedAt: null, completedAt: null },
  });
  const order = await tx.order.update({ where: { id: orderId }, data: { currentStage: REWORK_STAGE, status: "IN_PRODUCTION" } });
  await tx.project.update({ where: { id: order.projectId }, data: { status: "IN_PRODUCTION" } });
}

export async function addEvidence(actor: Actor, orderId: string, stage: MilestoneStage, file: File, note?: string) {
  assertRole(actor, "MANUFACTURER");
  const order = await loadOrder(db, actor, orderId);
  if (order.currentStage !== stage) throw conflict("Evidence can only be added to the current stage.");
  const milestone = await db.productionMilestone.findUniqueOrThrow({ where: { orderId_stage: { orderId, stage } } });
  if (milestone.status !== "IN_PROGRESS" && milestone.status !== "AWAITING_APPROVAL") throw conflict("This stage is not open for evidence.");
  const stored = await saveUpload(file, "evidence");
  try {
    return await db.$transaction(async (tx) => {
      const ev = await tx.milestoneEvidence.create({ data: { milestoneId: milestone.id, uploadedById: actor.id, note, ...stored } });
      await logActivity(tx, { actorId: actor.id, orderId, projectId: order.projectId, type: "EVIDENCE_ADDED", message: `Evidence added to ${stageLabel(stage)}: ${stored.fileName}.` });
      return ev;
    });
  } catch (e) {
    await deleteStoredFile(stored.fileKey);
    throw e;
  }
}

/** Manufacturer completes an evidence-gated stage (fabric sourcing, cutting, stitching, finishing). */
export async function completeEvidenceStage(actor: Actor, orderId: string, stage: MilestoneStage, note?: string) {
  assertRole(actor, "MANUFACTURER");
  const def = STAGE_BY_KEY[stage];
  if (def.gate !== "evidence") {
    const how = { sample: "when the brand approves a sample", qc: "when the brand accepts a passing QC report", shipment: "by recording the shipment", delivery: "when the brand confirms delivery", evidence: "" }[def.gate];
    throw conflict(`${def.label} completes ${how}.`);
  }
  await db.$transaction(async (tx) => {
    const order = await loadOrder(tx, actor, orderId);
    assertParty(actor, order, "MANUFACTURER");
    if (order.currentStage !== stage) throw conflict(`${def.label} is not the current stage. Current stage: ${stageLabel(order.currentStage)}.`);
    const count = await tx.milestoneEvidence.count({ where: { milestone: { orderId, stage } } });
    if (!count) throw invalid(`Upload evidence for ${def.label.toLowerCase()} first: ${def.requirement.toLowerCase()}.`);
    await completeStage(tx, orderId, stage, actor.id, note);
    // When finishing completes after a rework, the rework task is ready for re-inspection.
    if (stage === "FINISHING") {
      const open = await tx.reworkTask.count({ where: { orderId, status: "OPEN" } });
      if (open) await logActivity(tx, { actorId: actor.id, orderId, type: "REWORK_READY", message: "Reworked batch is ready for re-inspection." });
    }
  });
}

export async function recordShipment(actor: Actor, orderId: string, carrier: string, trackingNumber: string) {
  assertRole(actor, "MANUFACTURER");
  await db.$transaction(async (tx) => {
    const order = await loadOrder(tx, actor, orderId);
    assertParty(actor, order, "MANUFACTURER");
    if (order.currentStage !== "SHIPPING") throw conflict("The order is not ready to ship yet.");
    await tx.order.update({ where: { id: orderId }, data: { trackingInfo: `${carrier} · ${trackingNumber}`, shippedAt: new Date() } });
    await completeStage(tx, orderId, "SHIPPING", actor.id, `Shipped with ${carrier}, tracking ${trackingNumber}.`);
    await notify(tx, order.brandId, "ORDER_SHIPPED", "Order shipped", `Order ${order.reference} shipped with ${carrier} (tracking ${trackingNumber}).`, `/orders/${orderId}`);
  });
}

export async function confirmDelivery(actor: Actor, orderId: string, note?: string) {
  assertRole(actor, "BRAND");
  await db.$transaction(async (tx) => {
    const order = await loadOrder(tx, actor, orderId);
    assertParty(actor, order, "BRAND");
    if (order.currentStage !== "DELIVERY") throw conflict("Delivery can be confirmed after the order has shipped.");
    await completeStage(tx, orderId, "DELIVERY", actor.id, note);
  });
}

/**
 * Flags milestones that passed their planned end and notifies the brand, the manufacturer and
 * admins once per milestone. Runs when dashboards load, so no background worker is needed.
 */
export async function refreshDelays(now = new Date()) {
  const overdue = await db.productionMilestone.findMany({
    where: { isDelayed: false, status: { in: ["IN_PROGRESS", "AWAITING_APPROVAL"] }, plannedEnd: { lt: now }, order: { status: { notIn: ["DELIVERED", "CANCELLED"] } } },
    include: { order: { select: { id: true, reference: true, brandId: true, manufacturerId: true, projectId: true } } },
    take: 200,
  });
  for (const m of overdue) {
    await db.$transaction(async (tx) => {
      const flagged = await tx.productionMilestone.updateMany({ where: { id: m.id, isDelayed: false }, data: { isDelayed: true, delayReason: "Planned end date passed" } });
      if (!flagged.count) return;
      const msg = `${stageLabel(m.stage)} on order ${m.order.reference} is past its planned end date.`;
      await notify(tx, [m.order.brandId, m.order.manufacturerId], "ORDER_DELAYED", "Milestone delayed", msg, `/orders/${m.order.id}`);
      await notifyAdmins(tx, "ORDER_DELAYED", "Milestone delayed", msg, `/admin/orders?delayed=1`);
      await logActivity(tx, { actorId: null, orderId: m.order.id, projectId: m.order.projectId, type: "MILESTONE_DELAYED", message: msg });
    });
  }
  return overdue.length;
}

export async function postMessage(actor: Actor, orderId: string, body: string, milestoneId?: string) {
  await db.$transaction(async (tx) => {
    const order = await loadOrder(tx, actor, orderId);
    if (milestoneId) {
      const m = await tx.productionMilestone.findFirst({ where: { id: milestoneId, orderId } });
      if (!m) throw notFound("Milestone");
    }
    await tx.message.create({ data: { orderId, milestoneId, authorId: actor.id, body } });
    const recipients = [order.brandId, order.manufacturerId].filter((id) => id !== actor.id);
    await notify(tx, recipients, "MESSAGE_RECEIVED", `New message on ${order.reference}`, body.length > 140 ? `${body.slice(0, 137)}…` : body, `/orders/${orderId}#messages`);
  });
}

export async function getOrder(actor: Actor, orderId: string) {
  const order = await db.order.findFirst({
    where: { id: orderId, ...orderScope(actor) },
    include: {
      project: { include: { attachments: { orderBy: [{ kind: "asc" }, { version: "desc" }] } } },
      brand: { select: { name: true, brandProfile: { select: { companyName: true } } } },
      manufacturer: { select: { name: true, manufacturerProfile: { select: { businessName: true, city: true, country: true } } } },
      milestones: { orderBy: { sequence: "asc" }, include: { evidence: { orderBy: { createdAt: "desc" } }, responsibleUser: { select: { name: true } } } },
      samples: { orderBy: { round: "desc" }, include: { photos: true, reviewedBy: { select: { name: true } } } },
      qcReports: { orderBy: { createdAt: "desc" }, include: { defects: true, photos: true, rework: true, inspector: { select: { name: true } } } },
      reworkTasks: { orderBy: { createdAt: "desc" } },
      paymentMilestones: { orderBy: { sequence: "asc" }, include: { transactions: { orderBy: { createdAt: "desc" } } } },
      messages: { orderBy: { createdAt: "asc" }, take: 200, include: { author: { select: { name: true, role: true } } } },
      activities: { orderBy: { createdAt: "desc" }, take: 50, include: { actor: { select: { name: true } } } },
      issues: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!order) throw notFound("Order");
  return order;
}

export type OrderListFilters = { q?: string; status?: OrderStatus | "ACTIVE"; delayed?: boolean; attention?: "samples" | "qc"; page?: number; pageSize?: number };

export async function listOrders(actor: Actor, f: OrderListFilters = {}) {
  const pageSize = Math.min(f.pageSize ?? 10, 50);
  const page = Math.max(1, f.page ?? 1);
  const where: Prisma.OrderWhereInput = {
    AND: [
      orderScope(actor),
      f.q ? { OR: [{ reference: { contains: f.q, mode: "insensitive" } }, { project: { name: { contains: f.q, mode: "insensitive" } } }] } : {},
      f.status === "ACTIVE" ? { status: { notIn: ["DELIVERED", "CANCELLED"] } } : f.status ? { status: f.status } : {},
      f.delayed ? { status: { notIn: ["DELIVERED", "CANCELLED"] }, OR: [{ milestones: { some: { isDelayed: true, completedAt: null } } }, { expectedCompletionDate: { lt: new Date() } }] } : {},
      f.attention === "samples" ? { samples: { some: { status: "SUBMITTED" } } } : {},
      f.attention === "qc" ? { qcReports: { some: { result: "PASS", brandDecision: "PENDING" } } } : {},
    ],
  };
  const [items, total] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        project: { select: { name: true, category: true } },
        brand: { select: { brandProfile: { select: { companyName: true } } } },
        manufacturer: { select: { manufacturerProfile: { select: { businessName: true } } } },
        milestones: { select: { stage: true, status: true, isDelayed: true, plannedEnd: true, completedAt: true } },
      },
    }),
    db.order.count({ where }),
  ]);
  return { items, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
}
