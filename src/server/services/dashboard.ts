import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { Actor } from "@/server/actor";
import { assertRole } from "@/server/access";
import { expireQuotations } from "./quotations";
import { refreshDelays } from "./orders";

const ACTIVE_ORDER: Prisma.OrderWhereInput = { status: { notIn: ["DELIVERED", "CANCELLED"] } };
const delayedOrder = (): Prisma.OrderWhereInput => ({
  ...ACTIVE_ORDER,
  OR: [{ milestones: { some: { isDelayed: true, completedAt: null } } }, { expectedCompletionDate: { lt: new Date() } }],
});

/** All figures are counted from database records at request time. */
export async function brandDashboard(actor: Actor) {
  assertRole(actor, "BRAND");
  await Promise.all([refreshDelays(), expireQuotations({ project: { brandId: actor.id } })]);
  const mine = { brandId: actor.id };
  const [activeProjects, drafts, activeOrders, pendingQuotations, samplesToReview, delayedOrders, pendingQc, payments, notifications] = await Promise.all([
    db.project.count({ where: { ...mine, status: { in: ["SUBMITTED", "QUOTING"] } } }),
    db.project.count({ where: { ...mine, status: "DRAFT" } }),
    db.order.count({ where: { ...mine, ...ACTIVE_ORDER } }),
    db.quotation.count({ where: { project: mine, status: "SUBMITTED" } }),
    db.sample.count({ where: { order: mine, status: "SUBMITTED" } }),
    db.order.count({ where: { ...mine, ...delayedOrder() } }),
    db.qCReport.count({ where: { order: mine, result: "PASS", brandDecision: "PENDING" } }),
    db.paymentMilestone.findMany({
      where: { order: mine, status: { in: ["DUE", "FAILED", "PROCESSING"] } },
      orderBy: { dueAt: "asc" },
      take: 5,
      include: { order: { select: { id: true, reference: true, project: { select: { name: true } } } } },
    }),
    db.notification.findMany({ where: { userId: actor.id }, orderBy: { createdAt: "desc" }, take: 6 }),
  ]);
  const totalProjects = await db.project.count({ where: mine });
  return { activeProjects, drafts, activeOrders, pendingQuotations, samplesToReview, delayedOrders, pendingQc, payments, notifications, isNew: totalProjects === 0 };
}

export async function manufacturerDashboard(actor: Actor) {
  assertRole(actor, "MANUFACTURER");
  await Promise.all([refreshDelays(), expireQuotations({ manufacturerId: actor.id })]);
  const mine = { manufacturerId: actor.id };
  const [profile, newOpportunities, openQuotes, revisionRequests, activeOrders, delayedOrders, actionOrders, paid, notifications] = await Promise.all([
    db.manufacturerProfile.findUnique({ where: { userId: actor.id }, select: { verificationStatus: true, verificationNote: true, businessName: true } }),
    db.matchResult.count({ where: { ...mine, project: { status: { in: ["SUBMITTED", "QUOTING"] }, quotations: { none: mine } } } }),
    db.quotation.count({ where: { ...mine, status: "SUBMITTED" } }),
    db.quotation.count({ where: { ...mine, status: "REVISION_REQUESTED" } }),
    db.order.count({ where: { ...mine, ...ACTIVE_ORDER } }),
    db.order.count({ where: { ...mine, ...delayedOrder() } }),
    db.order.findMany({
      where: { ...mine, ...ACTIVE_ORDER, currentStage: { not: "DELIVERY" } },
      orderBy: { expectedCompletionDate: "asc" },
      take: 6,
      include: { project: { select: { name: true } }, milestones: { select: { stage: true, status: true, plannedEnd: true, isDelayed: true, completedAt: true } } },
    }),
    db.paymentMilestone.groupBy({ by: ["currency"], where: { order: mine, status: "PAID" }, _sum: { amount: true } }),
    db.notification.findMany({ where: { userId: actor.id }, orderBy: { createdAt: "desc" }, take: 6 }),
  ]);
  return { profile, newOpportunities, openQuotes, revisionRequests, activeOrders, delayedOrders, actionOrders, paid, notifications };
}

export async function adminDashboard(actor: Actor) {
  assertRole(actor, "ADMIN");
  await refreshDelays();
  const since = new Date(Date.now() - 30 * 86400000);
  const [usersByRole, suspended, pendingFactories, verifiedFactories, ordersByStatus, delayedOrders, openDisputes, failedQc30, paidByCurrency, webhookErrors, projectsByStatus, recentAudit] = await Promise.all([
    db.user.groupBy({ by: ["role"], _count: true }),
    db.user.count({ where: { status: "SUSPENDED" } }),
    db.manufacturerProfile.count({ where: { verificationStatus: "PENDING" } }),
    db.manufacturerProfile.count({ where: { verificationStatus: "VERIFIED" } }),
    db.order.groupBy({ by: ["status"], _count: true }),
    db.order.count({ where: delayedOrder() }),
    db.issueReport.count({ where: { status: { in: ["OPEN", "IN_REVIEW"] } } }),
    db.qCReport.count({ where: { result: "FAIL", createdAt: { gte: since } } }),
    db.paymentMilestone.groupBy({ by: ["currency"], where: { status: "PAID" }, _sum: { amount: true } }),
    db.webhookEvent.count({ where: { error: { not: null }, processedAt: null } }),
    db.project.groupBy({ by: ["status"], _count: true }),
    db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 6, include: { actor: { select: { name: true } } } }),
  ]);
  return { usersByRole, suspended, pendingFactories, verifiedFactories, ordersByStatus, delayedOrders, openDisputes, failedQc30, paidByCurrency, webhookErrors, projectsByStatus, recentAudit };
}
