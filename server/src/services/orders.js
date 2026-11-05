/**
 * Orders and production milestones (port of src/server/services/orders.ts).
 *
 * Every Prisma `$transaction` is a MongoDB transaction (withTransaction) and every query inside it passes the
 * session. Conditional `updateMany` guards are conditional `updateOne` calls whose modifiedCount is checked.
 * Services return plain serialised objects (docs/mern/api.md §1.8), except createOrderFromQuotation which
 * returns the hydrated order document.
 */
import { randomBytes } from "node:crypto";
import { AttachmentKind } from "@fashinza/shared/enums.js";
import { allocateAmounts } from "@fashinza/shared/quotation-math.js";
import { DEFAULT_PAYMENT_SCHEDULE, nextStage, PAYMENT_DUE_DAYS, planMilestoneDates, REWORK_STAGE, STAGE_BY_KEY, STAGES, stageLabel } from "@fashinza/shared/workflow.js";
import { withTransaction } from "../db.js";
import { assertRole, orderFilter } from "../lib/access.js";
import { conflict, invalid, notFound } from "../lib/errors.js";
import { logActivity, notify, notifyAdmins } from "../lib/events.js";
import { idOf, sameId, toObjectId } from "../lib/ids.js";
import { by, groupByRef, mapById, oneByRef, pickName, sortWith } from "../lib/relations.js";
import { containsInsensitive, dec, money, serialize } from "../lib/serialize.js";
import { deleteStoredFile, saveUpload } from "../lib/storage.js";
import {
  ActivityLog,
  BrandProfile,
  IssueReport,
  ManufacturerProfile,
  Message,
  MilestoneEvidence,
  Order,
  PaymentMilestone,
  PaymentTransaction,
  ProductionMilestone,
  Project,
  ProjectAttachment,
  QCDefect,
  QCReport,
  QCReportPhoto,
  Quotation,
  ReworkTask,
  Sample,
  SamplePhoto,
  User,
} from "../models/index.js";

const DAY = 24 * 60 * 60 * 1000;
const CLOSED = ["DELIVERED", "CANCELLED"];

export function orderReference() {
  return `FZ-${new Date().getUTCFullYear()}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

/** Prisma findUniqueOrThrow: an unexpected missing record is an internal error, not a domain one. */
function orThrow(doc, what) {
  if (!doc) throw new Error(`${what} not found.`);
  return doc;
}

/**
 * Creates the order, its milestone plan and its payment schedule from an accepted quotation.
 * Called inside the accept-quotation transaction (SERVER-A). Returns the hydrated order document.
 * @param {import("mongoose").ClientSession} session
 * @param {string} quotationId
 * @param {string} actorId
 */
export async function createOrderFromQuotation(session, quotationId, actorId) {
  const q = orThrow(await Quotation.findById(toObjectId(quotationId)).session(session).lean(), "Quotation");
  const project = orThrow(await Project.findById(q.projectId).session(session).lean(), "Project");
  const now = new Date();
  const expected = new Date(now.getTime() + q.productionDays * DAY);
  const total = dec(q.totalAmount);
  const f2 = (v) => money(v, 2);
  const [order] = await Order.create(
    [
      {
        reference: orderReference(),
        projectId: q.projectId,
        quotationId: q._id,
        brandId: project.brandId,
        manufacturerId: q.manufacturerId,
        quantity: q.quantity,
        unitPrice: q.quantity ? total.dividedBy(q.quantity).toDecimalPlaces(2).toFixed(2) : f2(q.unitPrice),
        totalAmount: total.toFixed(2),
        currency: q.currency,
        expectedCompletionDate: expected,
        currentStage: STAGES[0].stage,
        agreedTerms: {
          quotationVersion: q.version,
          quantity: q.quantity,
          minQuantity: q.minQuantity,
          productionDays: q.productionDays,
          unitPrice: f2(q.unitPrice),
          fabricCostPerUnit: f2(q.fabricCostPerUnit),
          finishingCostPerUnit: f2(q.finishingCostPerUnit),
          packagingCostPerUnit: f2(q.packagingCostPerUnit),
          samplingCost: q.samplingCost != null ? f2(q.samplingCost) : "0.00",
          logisticsCost: f2(q.logisticsCost),
          taxPercent: f2(q.taxPercent),
          subtotal: f2(q.subtotal),
          taxAmount: f2(q.taxAmount),
          totalAmount: f2(q.totalAmount),
          currency: q.currency,
          notes: q.notes ?? null,
          // Sample request from the brief and the factory's sample proposal, as agreed.
          sampleRequired: project.sampleRequired,
          sampleQuantity: project.sampleRequired ? (project.sampleQuantity ?? null) : null,
          sampleSizes: project.sampleRequired ? (project.sampleSizes ?? []) : [],
          sampleRequestNotes: project.sampleRequired ? (project.sampleNotes ?? null) : null,
          sampleLeadTimeDays: q.sampleLeadTimeDays ?? null,
          sampleNotes: q.sampleNotes ?? null,
        },
      },
    ],
    { session },
  );
  const plan = planMilestoneDates(now, q.productionDays);
  await ProductionMilestone.insertMany(
    STAGES.map((s, i) => ({
      orderId: order._id,
      stage: s.stage,
      sequence: i + 1,
      responsibleParty: s.party,
      evidenceRequired: s.gate === "evidence",
      plannedStart: plan[i].plannedStart,
      plannedEnd: plan[i].plannedEnd,
      status: i === 0 ? "IN_PROGRESS" : "NOT_STARTED",
      startedAt: i === 0 ? now : null,
    })),
    { session },
  );
  const amounts = allocateAmounts(total.toString(), DEFAULT_PAYMENT_SCHEDULE.map((p) => p.percentage));
  await PaymentMilestone.insertMany(
    DEFAULT_PAYMENT_SCHEDULE.map((p, i) => ({
      orderId: order._id,
      sequence: i + 1,
      label: p.label,
      percentage: p.percentage,
      amount: amounts[i],
      currency: q.currency,
      triggerStage: p.triggerStage,
    })),
    { session },
  );
  await logActivity(session, {
    actorId,
    orderId: order._id,
    projectId: q.projectId,
    type: "ORDER_CREATED",
    message: `Order ${order.reference} created from quotation version ${q.version}.`,
  });
  return order;
}

/**
 * Order within the actor's scope (lean) with `project: { name }`, else NOT_FOUND "Order".
 * @param {import("mongoose").ClientSession | null} session
 */
export async function loadOrder(session, actor, orderId) {
  const id = toObjectId(orderId);
  if (!id) throw notFound("Order");
  const order = await Order.findOne({ $and: [{ _id: id }, orderFilter(actor)] })
    .session(session ?? null)
    .lean();
  if (!order) throw notFound("Order");
  const project = await Project.findById(order.projectId, { name: 1 })
    .session(session ?? null)
    .lean();
  return { ...order, project: project ? { name: project.name } : null };
}

function assertParty(actor, order, party) {
  const ok = party === "BRAND" ? sameId(actor.id, order.brandId) : sameId(actor.id, order.manufacturerId);
  if (!ok) throw invalid(party === "BRAND" ? "Only the brand that placed this order can do this." : "Only the manufacturer producing this order can do this.");
}

const STATUS_FOR_STAGE = {
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
 * @param {import("mongoose").ClientSession} session
 * @param {string} orderId
 * @param {string} stage
 * @param {string} actorId
 * @param {string} [note]
 */
export async function completeStage(session, orderId, stage, actorId, note) {
  const oid = toObjectId(orderId);
  const order = orThrow(await Order.findById(oid).session(session).lean(), "Order");
  const project = await Project.findById(order.projectId, { name: 1 }).session(session).lean();
  if (order.status === "CANCELLED" || order.status === "DELIVERED") throw conflict("This order is closed.");
  if (order.currentStage !== stage) throw conflict(`${stageLabel(stage)} is not the current stage. Current stage: ${stageLabel(order.currentStage)}.`);
  const milestone = orThrow(await ProductionMilestone.findOne({ orderId: oid, stage }).session(session).lean(), "Milestone");
  if (milestone.status === "COMPLETED") throw conflict(`${stageLabel(stage)} is already complete.`);
  const now = new Date();
  // Conditional update guards against two concurrent completions.
  const done = await ProductionMilestone.updateOne(
    { _id: milestone._id, status: { $in: ["IN_PROGRESS", "AWAITING_APPROVAL"] } },
    {
      $set: {
        status: "COMPLETED",
        completedAt: now,
        responsibleUserId: toObjectId(actorId),
        notes: note ?? milestone.notes ?? null,
        isDelayed: milestone.plannedEnd ? now > milestone.plannedEnd : false,
      },
    },
    { session },
  );
  if (!done.modifiedCount) throw conflict(`${stageLabel(stage)} cannot be completed from its current state.`);

  const next = nextStage(stage);
  if (next) {
    await ProductionMilestone.updateOne({ orderId: oid, stage: next }, { $set: { status: "IN_PROGRESS", startedAt: now } }, { session });
    const s = STATUS_FOR_STAGE[next];
    await Order.updateOne({ _id: oid }, { $set: { currentStage: next, status: s.order } }, { session });
    await Project.updateOne({ _id: order.projectId }, { $set: { status: s.project } }, { session });
  } else {
    await Order.updateOne({ _id: oid }, { $set: { status: "DELIVERED", deliveredAt: now } }, { session });
    await Project.updateOne({ _id: order.projectId }, { $set: { status: "DELIVERED" } }, { session });
  }

  const link = `/orders/${idOf(oid)}?tab=payments`;
  const due = await PaymentMilestone.find({ orderId: oid, triggerStage: stage, status: "SCHEDULED" }).sort({ sequence: 1 }).session(session).lean();
  for (const p of due) {
    await PaymentMilestone.updateOne({ _id: p._id }, { $set: { status: "DUE", dueAt: new Date(now.getTime() + PAYMENT_DUE_DAYS * DAY) } }, { session });
    await notify(session, order.brandId, "PAYMENT_UPDATE", "Payment milestone due", `${p.label} (${dec(p.percentage).toString()}%) for order ${order.reference} is now due.`, link);
    await notify(session, order.manufacturerId, "PAYMENT_UPDATE", "Payment milestone due", `${p.label} for order ${order.reference} is now due from the brand.`, link);
  }

  await logActivity(session, {
    actorId,
    orderId: oid,
    projectId: order.projectId,
    type: "MILESTONE_COMPLETED",
    message: `${stageLabel(stage)} completed.${next ? ` ${stageLabel(next)} started.` : " Order delivered."}`,
  });
  const recipients = [idOf(order.brandId), idOf(order.manufacturerId)].filter((id) => id !== idOf(actorId));
  if (recipients.length) {
    const projectName = project?.name;
    await notify(
      session,
      recipients,
      next ? "MILESTONE_UPDATED" : "ORDER_DELIVERED",
      next ? `${stageLabel(stage)} complete` : "Delivery confirmed",
      next ? `Order ${order.reference} (${projectName}) moved to ${stageLabel(next)}.` : `Order ${order.reference} (${projectName}) has been delivered.`,
      `/orders/${idOf(oid)}`,
    );
  }
}

/** Sends production back to the rework stage after a failed or rejected inspection. */
export async function rollbackForRework(session, orderId) {
  const oid = toObjectId(orderId);
  const now = new Date();
  const reworkSeq = STAGE_BY_KEY[REWORK_STAGE].sequence;
  const qcSeq = STAGE_BY_KEY.QUALITY_CONTROL.sequence;
  const rework = await ProductionMilestone.updateOne({ orderId: oid, stage: REWORK_STAGE }, { $set: { status: "IN_PROGRESS", startedAt: now, completedAt: null } }, { session });
  if (!rework.matchedCount) throw new Error("Milestone not found.");
  await ProductionMilestone.updateMany(
    { orderId: oid, sequence: { $gt: reworkSeq, $lte: qcSeq } },
    { $set: { status: "NOT_STARTED", startedAt: null, completedAt: null } },
    { session },
  );
  const order = orThrow(
    await Order.findOneAndUpdate({ _id: oid }, { $set: { currentStage: REWORK_STAGE, status: "IN_PRODUCTION" } }, { session, new: true }).lean(),
    "Order",
  );
  await Project.updateOne({ _id: order.projectId }, { $set: { status: "IN_PRODUCTION" } }, { session });
}

/**
 * Manufacturer uploads one evidence file to the current stage.
 * @param {any} file multer file object
 */
export async function addEvidence(actor, orderId, stage, file, note) {
  assertRole(actor, "MANUFACTURER");
  const order = await loadOrder(null, actor, orderId);
  if (order.currentStage !== stage) throw conflict("Evidence can only be added to the current stage.");
  const milestone = orThrow(await ProductionMilestone.findOne({ orderId: order._id, stage }).lean(), "Milestone");
  if (milestone.status !== "IN_PROGRESS" && milestone.status !== "AWAITING_APPROVAL") throw conflict("This stage is not open for evidence.");
  const stored = await saveUpload(file, "evidence");
  try {
    return await withTransaction(async (session) => {
      const [ev] = await MilestoneEvidence.create([{ milestoneId: milestone._id, uploadedById: toObjectId(actor.id), note: note ?? null, ...stored }], { session });
      await logActivity(session, {
        actorId: actor.id,
        orderId: order._id,
        projectId: order.projectId,
        type: "EVIDENCE_ADDED",
        message: `Evidence added to ${stageLabel(stage)}: ${stored.fileName}.`,
      });
      return serialize(MilestoneEvidence, ev);
    });
  } catch (e) {
    await deleteStoredFile(stored.fileKey);
    throw e;
  }
}

/** Manufacturer completes an evidence-gated stage (fabric sourcing, cutting, stitching, finishing). */
export async function completeEvidenceStage(actor, orderId, stage, note) {
  assertRole(actor, "MANUFACTURER");
  const def = STAGE_BY_KEY[stage];
  if (def.gate !== "evidence") {
    const how = {
      sample: "when the brand approves a sample",
      qc: "when the brand accepts a passing QC report",
      shipment: "by recording the shipment",
      delivery: "when the brand confirms delivery",
      evidence: "",
    }[def.gate];
    throw conflict(`${def.label} completes ${how}.`);
  }
  await withTransaction(async (session) => {
    const order = await loadOrder(session, actor, orderId);
    assertParty(actor, order, "MANUFACTURER");
    if (order.currentStage !== stage) throw conflict(`${def.label} is not the current stage. Current stage: ${stageLabel(order.currentStage)}.`);
    const milestone = await ProductionMilestone.findOne({ orderId: order._id, stage }, { _id: 1 }).session(session).lean();
    const count = milestone ? await MilestoneEvidence.countDocuments({ milestoneId: milestone._id }).session(session) : 0;
    if (!count) throw invalid(`Upload evidence for ${def.label.toLowerCase()} first: ${def.requirement.toLowerCase()}.`);
    await completeStage(session, idOf(order._id), stage, actor.id, note);
    // When finishing completes after a rework, the rework task is ready for re-inspection.
    if (stage === "FINISHING") {
      const open = await ReworkTask.countDocuments({ orderId: order._id, status: "OPEN" }).session(session);
      if (open) await logActivity(session, { actorId: actor.id, orderId: order._id, type: "REWORK_READY", message: "Reworked batch is ready for re-inspection." });
    }
  });
}

export async function recordShipment(actor, orderId, carrier, trackingNumber) {
  assertRole(actor, "MANUFACTURER");
  await withTransaction(async (session) => {
    const order = await loadOrder(session, actor, orderId);
    assertParty(actor, order, "MANUFACTURER");
    if (order.currentStage !== "SHIPPING") throw conflict("The order is not ready to ship yet.");
    await Order.updateOne({ _id: order._id }, { $set: { trackingInfo: `${carrier} · ${trackingNumber}`, shippedAt: new Date() } }, { session });
    await completeStage(session, idOf(order._id), "SHIPPING", actor.id, `Shipped with ${carrier}, tracking ${trackingNumber}.`);
    await notify(session, order.brandId, "ORDER_SHIPPED", "Order shipped", `Order ${order.reference} shipped with ${carrier} (tracking ${trackingNumber}).`, `/orders/${idOf(order._id)}`);
  });
}

export async function confirmDelivery(actor, orderId, note) {
  assertRole(actor, "BRAND");
  await withTransaction(async (session) => {
    const order = await loadOrder(session, actor, orderId);
    assertParty(actor, order, "BRAND");
    if (order.currentStage !== "DELIVERY") throw conflict("Delivery can be confirmed after the order has shipped.");
    await completeStage(session, idOf(order._id), "DELIVERY", actor.id, note);
  });
}

/**
 * Flags milestones that passed their planned end and notifies the brand, the manufacturer and
 * admins once per milestone. Runs when dashboards load, so no background worker is needed.
 * Returns how many overdue milestones were found (at most 200 per call).
 */
export async function refreshDelays(now = new Date()) {
  const overdue = await ProductionMilestone.aggregate([
    { $match: { isDelayed: false, status: { $in: ["IN_PROGRESS", "AWAITING_APPROVAL"] }, plannedEnd: { $lt: now } } },
    { $lookup: { from: Order.collection.name, localField: "orderId", foreignField: "_id", as: "order", pipeline: [{ $project: { reference: 1, brandId: 1, manufacturerId: 1, projectId: 1, status: 1 } }] } },
    { $unwind: "$order" },
    { $match: { "order.status": { $nin: CLOSED } } },
    { $limit: 200 },
  ]);
  for (const m of overdue) {
    await withTransaction(async (session) => {
      const flagged = await ProductionMilestone.updateOne({ _id: m._id, isDelayed: false }, { $set: { isDelayed: true, delayReason: "Planned end date passed" } }, { session });
      if (!flagged.modifiedCount) return;
      const msg = `${stageLabel(m.stage)} on order ${m.order.reference} is past its planned end date.`;
      await notify(session, [m.order.brandId, m.order.manufacturerId], "ORDER_DELAYED", "Milestone delayed", msg, `/orders/${idOf(m.order._id)}`);
      await notifyAdmins(session, "ORDER_DELAYED", "Milestone delayed", msg, `/admin/orders?delayed=1`);
      await logActivity(session, { actorId: null, orderId: m.order._id, projectId: m.order.projectId, type: "MILESTONE_DELAYED", message: msg });
    });
  }
  return overdue.length;
}

export async function postMessage(actor, orderId, body, milestoneId) {
  await withTransaction(async (session) => {
    const order = await loadOrder(session, actor, orderId);
    let mid = null;
    if (milestoneId) {
      mid = toObjectId(milestoneId);
      const m = mid ? await ProductionMilestone.findOne({ _id: mid, orderId: order._id }, { _id: 1 }).session(session).lean() : null;
      if (!m) throw notFound("Milestone");
    }
    await Message.create([{ orderId: order._id, milestoneId: mid, authorId: toObjectId(actor.id), body }], { session });
    const recipients = [idOf(order.brandId), idOf(order.manufacturerId)].filter((id) => id !== actor.id);
    await notify(
      session,
      recipients,
      "MESSAGE_RECEIVED",
      `New message on ${order.reference}`,
      body.length > 140 ? `${body.slice(0, 137)}…` : body,
      `/orders/${idOf(order._id)}?tab=messages`,
    );
  });
}

/** Full order page data (GET /api/orders/:id), with the relation tree of the original `getOrder`. */
export async function getOrder(actor, orderId) {
  const id = toObjectId(orderId);
  if (!id) throw notFound("Order");
  const order = await Order.findOne({ $and: [{ _id: id }, orderFilter(actor)] }).lean();
  if (!order) throw notFound("Order");

  const [project, attachments, brand, brandProfile, manufacturer, manufacturerProfile, milestones, samples, qcReports, reworkTasks, paymentMilestones, messages, activities, issues] =
    await Promise.all([
      Project.findById(order.projectId).lean(),
      ProjectAttachment.find({ projectId: order.projectId }).lean(),
      User.findById(order.brandId, { name: 1 }).lean(),
      BrandProfile.findOne({ userId: order.brandId }, { companyName: 1 }).lean(),
      User.findById(order.manufacturerId, { name: 1 }).lean(),
      ManufacturerProfile.findOne({ userId: order.manufacturerId }, { businessName: 1, city: 1, country: 1 }).lean(),
      ProductionMilestone.find({ orderId: id }).sort({ sequence: 1 }).lean(),
      Sample.find({ orderId: id }).sort({ round: -1 }).lean(),
      QCReport.find({ orderId: id }).sort({ createdAt: -1, _id: -1 }).lean(),
      ReworkTask.find({ orderId: id }).sort({ createdAt: -1, _id: -1 }).lean(),
      PaymentMilestone.find({ orderId: id }).sort({ sequence: 1 }).lean(),
      Message.find({ orderId: id }).sort({ createdAt: 1, _id: 1 }).limit(200).lean(),
      ActivityLog.find({ orderId: id }).sort({ createdAt: -1, _id: -1 }).limit(50).lean(),
      IssueReport.find({ orderId: id }).sort({ createdAt: -1, _id: -1 }).lean(),
    ]);

  const milestoneIds = milestones.map((m) => m._id);
  const sampleIds = samples.map((s) => s._id);
  const reportIds = qcReports.map((r) => r._id);
  const userIds = [
    ...milestones.map((m) => m.responsibleUserId),
    ...samples.map((s) => s.reviewedById),
    ...qcReports.map((r) => r.inspectorId),
    ...messages.map((m) => m.authorId),
    ...activities.map((a) => a.actorId),
  ].filter(Boolean);

  const [evidence, photos, defects, reportPhotos, transactions, users] = await Promise.all([
    groupByRef(MilestoneEvidence, "milestoneId", milestoneIds, { sort: { createdAt: -1, _id: -1 } }),
    groupByRef(SamplePhoto, "sampleId", sampleIds, { sort: { _id: 1 } }),
    groupByRef(QCDefect, "reportId", reportIds, { sort: { _id: 1 } }),
    groupByRef(QCReportPhoto, "reportId", reportIds, { sort: { _id: 1 } }),
    groupByRef(PaymentTransaction, "paymentMilestoneId", paymentMilestones.map((p) => p._id), { sort: { createdAt: -1, _id: -1 } }),
    mapById(User, userIds, { name: 1, role: 1 }),
  ]);
  const reworkByReport = new Map(reworkTasks.map((t) => [idOf(t.qcReportId), t]));
  const user = (uid) => (uid ? users.get(idOf(uid)) : undefined);

  // Attachments: kind (enum order) asc, version desc with NULLs first (PostgreSQL DESC).
  const sortedAttachments = sortWith(attachments, by((a) => a.kind, { enumValues: AttachmentKind }), by((a) => a.version, { dir: "desc" }), by((a) => a._id));

  return {
    ...serialize(Order, order),
    project: project ? { ...serialize(Project, project), attachments: serialize(ProjectAttachment, sortedAttachments) } : null,
    brand: brand ? { name: brand.name, brandProfile: brandProfile ? { companyName: brandProfile.companyName } : null } : null,
    manufacturer: manufacturer
      ? {
          name: manufacturer.name,
          manufacturerProfile: manufacturerProfile
            ? { businessName: manufacturerProfile.businessName, city: manufacturerProfile.city, country: manufacturerProfile.country }
            : null,
        }
      : null,
    milestones: milestones.map((m) => ({
      ...serialize(ProductionMilestone, m),
      evidence: serialize(MilestoneEvidence, evidence.get(idOf(m._id)) ?? []),
      responsibleUser: pickName(user(m.responsibleUserId)),
    })),
    samples: samples.map((s) => ({
      ...serialize(Sample, s),
      photos: serialize(SamplePhoto, photos.get(idOf(s._id)) ?? []),
      reviewedBy: pickName(user(s.reviewedById)),
    })),
    qcReports: qcReports.map((r) => {
      const rework = reworkByReport.get(idOf(r._id));
      return {
        ...serialize(QCReport, r),
        defects: serialize(QCDefect, defects.get(idOf(r._id)) ?? []),
        photos: serialize(QCReportPhoto, reportPhotos.get(idOf(r._id)) ?? []),
        rework: rework ? serialize(ReworkTask, rework) : null,
        inspector: pickName(user(r.inspectorId)),
      };
    }),
    reworkTasks: serialize(ReworkTask, reworkTasks),
    paymentMilestones: paymentMilestones.map((p) => ({
      ...serialize(PaymentMilestone, p),
      transactions: serialize(PaymentTransaction, transactions.get(idOf(p._id)) ?? []),
    })),
    messages: messages.map((m) => {
      const a = user(m.authorId);
      return { ...serialize(Message, m), author: a ? { name: a.name, role: a.role } : null };
    }),
    activities: activities.map((a) => ({ ...serialize(ActivityLog, a), actor: pickName(user(a.actorId)) })),
    issues: serialize(IssueReport, issues),
  };
}

/** Ids of active orders with a delayed open milestone or a passed expected completion date (`delayedOrder()`). */
export async function delayedOrderFilter(now = new Date()) {
  const withDelayedMilestone = await ProductionMilestone.distinct("orderId", { isDelayed: true, completedAt: null });
  return { status: { $nin: CLOSED }, $or: [{ _id: { $in: withDelayedMilestone } }, { expectedCompletionDate: { $lt: now } }] };
}

/**
 * Orders list (GET /api/orders, /api/admin/orders and search).
 * @param {{ q?: string, status?: string, delayed?: boolean, attention?: "samples" | "qc", page?: number, pageSize?: number }} [f]
 */
export async function listOrders(actor, f = {}) {
  const pageSize = Math.min(f.pageSize ?? 10, 50);
  const page = Math.max(1, f.page ?? 1);
  /** @type {Record<string, unknown>[]} */
  const and = [orderFilter(actor)];
  if (f.q) {
    const rx = containsInsensitive(f.q);
    const projectIds = await Project.distinct("_id", { name: rx });
    and.push({ $or: [{ reference: rx }, { projectId: { $in: projectIds } }] });
  }
  if (f.status === "ACTIVE") and.push({ status: { $nin: CLOSED } });
  else if (f.status) and.push({ status: f.status });
  if (f.delayed) and.push(await delayedOrderFilter());
  if (f.attention === "samples") and.push({ _id: { $in: await Sample.distinct("orderId", { status: "SUBMITTED" }) } });
  if (f.attention === "qc") and.push({ _id: { $in: await QCReport.distinct("orderId", { result: "PASS", brandDecision: "PENDING" }) } });
  const where = { $and: and };

  const [orders, total] = await Promise.all([
    Order.find(where)
      .sort({ updatedAt: -1, _id: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    Order.countDocuments(where),
  ]);
  const [projects, brandProfiles, factoryProfiles, milestones] = await Promise.all([
    mapById(Project, orders.map((o) => o.projectId), { name: 1, category: 1 }),
    oneByRef(BrandProfile, "userId", orders.map((o) => o.brandId), { userId: 1, companyName: 1 }),
    oneByRef(ManufacturerProfile, "userId", orders.map((o) => o.manufacturerId), { userId: 1, businessName: 1 }),
    groupByRef(ProductionMilestone, "orderId", orders.map((o) => o._id), {
      projection: { orderId: 1, stage: 1, status: 1, isDelayed: 1, plannedEnd: 1, completedAt: 1 },
      sort: { sequence: 1 },
    }),
  ]);
  const items = orders.map((o) => {
    const p = projects.get(idOf(o.projectId));
    const bp = brandProfiles.get(idOf(o.brandId));
    const mp = factoryProfiles.get(idOf(o.manufacturerId));
    return {
      ...serialize(Order, o),
      project: p ? { name: p.name, category: p.category } : null,
      brand: { brandProfile: bp ? { companyName: bp.companyName } : null },
      manufacturer: { manufacturerProfile: mp ? { businessName: mp.businessName } : null },
      milestones: (milestones.get(idOf(o._id)) ?? []).map((m) => ({
        stage: m.stage,
        status: m.status,
        isDelayed: m.isDelayed,
        plannedEnd: m.plannedEnd ?? null,
        completedAt: m.completedAt ?? null,
      })),
    };
  });
  return { items, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
}
