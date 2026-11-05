/**
 * Dashboards (port of src/server/services/dashboard.ts). All figures are counted from database records at
 * request time.
 */
import { OrderStatus, ProjectStatus, Role } from "@fashinza/shared/enums.js";
import { assertRole } from "../lib/access.js";
import { idOf, toObjectId } from "../lib/ids.js";
import { mapById, nullAwareSort } from "../lib/relations.js";
import { serialize } from "../lib/serialize.js";
import {
  AuditLog,
  IssueReport,
  ManufacturerProfile,
  MatchResult,
  Notification,
  Order,
  PaymentMilestone,
  ProductionMilestone,
  Project,
  QCReport,
  Quotation,
  Sample,
  User,
  WebhookEvent,
} from "../models/index.js";
import { countBy, resolveAuditTargets } from "./admin.js";
import { delayedOrderFilter, refreshDelays } from "./orders.js";
import { groupPaymentMilestones } from "./payments.js";
import { expireQuotations } from "./quotations.js";

const ACTIVE_ORDER = { status: { $nin: ["DELIVERED", "CANCELLED"] } };

/** `order: { id, reference, project: { name } }` for payment milestones. */
async function withOrderSummary(milestones) {
  const orders = await mapById(Order, milestones.map((p) => p.orderId), { reference: 1, projectId: 1 });
  const projects = await mapById(Project, [...orders.values()].map((o) => o.projectId), { name: 1 });
  return milestones.map((pm) => {
    const o = orders.get(idOf(pm.orderId));
    const p = o && projects.get(idOf(o.projectId));
    return { ...serialize(PaymentMilestone, pm), order: o ? { id: idOf(o._id), reference: o.reference, project: p ? { name: p.name } : null } : null };
  });
}

const recentNotifications = (actor) =>
  Notification.find({ userId: toObjectId(actor.id) })
    .sort({ createdAt: -1, _id: -1 })
    .limit(6)
    .lean()
    .then((rows) => serialize(Notification, rows));

export async function brandDashboard(actor) {
  assertRole(actor, "BRAND");
  await Promise.all([refreshDelays(), expireQuotations({ project: { brandId: actor.id } })]);
  const mine = { brandId: toObjectId(actor.id) };
  const [projectIds, orderIds] = await Promise.all([Project.distinct("_id", mine), Order.distinct("_id", mine)]);
  const byOrder = { orderId: { $in: orderIds } };
  const dueOrder = nullAwareSort([
    ["dueAt", 1, "last"],
    ["_id", 1],
  ]);
  const [activeProjects, drafts, activeOrders, pendingQuotations, samplesToReview, delayedOrders, pendingQc, payments, notifications, openPayments] = await Promise.all([
    Project.countDocuments({ ...mine, status: { $in: ["SUBMITTED", "QUOTING"] } }),
    Project.countDocuments({ ...mine, status: "DRAFT" }),
    Order.countDocuments({ ...mine, ...ACTIVE_ORDER }),
    Quotation.countDocuments({ projectId: { $in: projectIds }, status: "SUBMITTED" }),
    Sample.countDocuments({ ...byOrder, status: "SUBMITTED" }),
    delayedOrderFilter().then((delayed) => Order.countDocuments({ $and: [mine, delayed] })),
    QCReport.countDocuments({ ...byOrder, result: "PASS", brandDecision: "PENDING" }),
    PaymentMilestone.aggregate([
      { $match: { ...byOrder, status: { $in: ["DUE", "FAILED", "PROCESSING"] } } },
      dueOrder.addFields,
      dueOrder.sort,
      { $limit: 5 },
      dueOrder.unset,
    ]).then(withOrderSummary),
    recentNotifications(actor),
    // Uncapped totals of due and failed milestones per order and currency (the `payments` list above stops at 5).
    groupPaymentMilestones({ ...byOrder, status: { $in: ["DUE", "FAILED"] } }, ["orderId", "status", "currency"], { count: true }),
  ]);
  const totalProjects = projectIds.length;
  return { activeProjects, drafts, activeOrders, pendingQuotations, samplesToReview, delayedOrders, pendingQc, payments, notifications, openPayments, isNew: totalProjects === 0 };
}

export async function manufacturerDashboard(actor) {
  assertRole(actor, "MANUFACTURER");
  await Promise.all([refreshDelays(), expireQuotations({ manufacturerId: actor.id })]);
  const mine = { manufacturerId: toObjectId(actor.id) };
  const openStage = { ...mine, ...ACTIVE_ORDER, currentStage: { $ne: "DELIVERY" } };
  const [profile, newOpportunities, openQuotes, revisionRequests, activeOrders, delayedOrders, actionOrders, paid, notifications, stageStates] = await Promise.all([
    ManufacturerProfile.findOne({ userId: mine.manufacturerId }, { verificationStatus: 1, verificationNote: 1, businessName: 1 })
      .lean()
      .then((p) => (p ? { verificationStatus: p.verificationStatus, verificationNote: p.verificationNote ?? null, businessName: p.businessName } : null)),
    // Matches on open projects this factory has not quoted on yet.
    Promise.all([MatchResult.distinct("projectId", mine), Quotation.distinct("projectId", mine)])
      .then(([matched, quoted]) => {
        const quotedSet = new Set(quoted.map(idOf));
        return Project.distinct("_id", { _id: { $in: matched.filter((id) => !quotedSet.has(idOf(id))) }, status: { $in: ["SUBMITTED", "QUOTING"] } });
      })
      .then((open) => MatchResult.countDocuments({ ...mine, projectId: { $in: open } })),
    Quotation.countDocuments({ ...mine, status: "SUBMITTED" }),
    Quotation.countDocuments({ ...mine, status: "REVISION_REQUESTED" }),
    Order.countDocuments({ ...mine, ...ACTIVE_ORDER }),
    delayedOrderFilter().then((delayed) => Order.countDocuments({ $and: [mine, delayed] })),
    Order.find(openStage)
      .sort({ expectedCompletionDate: 1, _id: 1 })
      .limit(6)
      .lean()
      .then(async (orders) => {
        const [projects, milestones] = await Promise.all([mapById(Project, orders.map((o) => o.projectId), { name: 1 }), milestonesOf(orders, ["stage", "status", "plannedEnd", "isDelayed", "completedAt"])]);
        return orders.map((o) => {
          const p = projects.get(idOf(o.projectId));
          return { ...serialize(Order, o), project: p ? { name: p.name } : null, milestones: milestones.get(idOf(o._id)) ?? [] };
        });
      }),
    Order.distinct("_id", mine).then((ids) => groupPaymentMilestones({ orderId: { $in: ids }, status: "PAID" }, ["currency"])),
    recentNotifications(actor),
    // Uncapped: the current stage of every open order before delivery, to count whose turn it is.
    Order.find(openStage, { currentStage: 1 })
      .lean()
      .then(async (orders) => {
        const milestones = await milestonesOf(orders, ["stage", "status", "isDelayed"]);
        return orders.map((o) => ({ id: idOf(o._id), currentStage: o.currentStage, milestones: milestones.get(idOf(o._id)) ?? [] }));
      }),
  ]);
  return { profile, newOpportunities, openQuotes, revisionRequests, activeOrders, delayedOrders, actionOrders, paid, notifications, stageStates };
}

/** Selected milestone fields per order (sequence order), as Prisma `milestones: { select }`. */
async function milestonesOf(orders, fields) {
  const rows = await ProductionMilestone.find({ orderId: { $in: orders.map((o) => o._id) } }, { orderId: 1, ...Object.fromEntries(fields.map((f) => [f, 1])) })
    .sort({ sequence: 1 })
    .lean();
  /** @type {Map<string, Record<string, unknown>[]>} */
  const out = new Map();
  for (const m of rows) {
    const key = idOf(m.orderId);
    if (!out.has(key)) out.set(key, []);
    out.get(key).push(Object.fromEntries(fields.map((f) => [f, m[f] ?? null])));
  }
  return out;
}

export async function adminDashboard(actor) {
  assertRole(actor, "ADMIN");
  await refreshDelays();
  const since = new Date(Date.now() - 30 * 86400000);
  const [usersByRole, suspended, pendingFactories, verifiedFactories, ordersByStatus, delayedOrders, openDisputes, failedQc30, paidByCurrency, webhookErrors, projectsByStatus, recentAudit] =
    await Promise.all([
      countBy(User, "role", Role),
      User.countDocuments({ status: "SUSPENDED" }),
      ManufacturerProfile.countDocuments({ verificationStatus: "PENDING" }),
      ManufacturerProfile.countDocuments({ verificationStatus: "VERIFIED" }),
      countBy(Order, "status", OrderStatus),
      delayedOrderFilter().then((delayed) => Order.countDocuments(delayed)),
      IssueReport.countDocuments({ status: { $in: ["OPEN", "IN_REVIEW"] } }),
      QCReport.countDocuments({ result: "FAIL", createdAt: { $gte: since } }),
      groupPaymentMilestones({ status: "PAID" }, ["currency"]),
      WebhookEvent.countDocuments({ error: { $ne: null }, processedAt: null }),
      countBy(Project, "status", ProjectStatus),
      AuditLog.find().sort({ createdAt: -1, _id: -1 }).limit(6).lean(),
    ]);
  const [actors, targets] = await Promise.all([mapById(User, recentAudit.map((a) => a.actorId), { name: 1 }), resolveAuditTargets(recentAudit)]);
  return {
    usersByRole,
    suspended,
    pendingFactories,
    verifiedFactories,
    ordersByStatus,
    delayedOrders,
    openDisputes,
    failedQc30,
    paidByCurrency,
    webhookErrors,
    projectsByStatus,
    recentAudit: recentAudit.map((a) => {
      const u = actors.get(idOf(a.actorId));
      return { ...serialize(AuditLog, a), actor: u ? { name: u.name } : null, target: targets[a.targetId] };
    }),
  };
}
