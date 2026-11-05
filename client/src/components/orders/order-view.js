import { STAGE_BY_KEY, daysOverdue, estimateDelivery } from "@fashinza/shared/workflow.js";

/*
 * `order` is the `GET /api/orders/:id` tree with its dates revived (lib/data.js `loadData`); `actor` is the
 * signed-in session user ({ id, role, name, email, … }).
 */

/** Payment states the brand can (re)start a checkout from. */
export const PAYABLE_STATUSES = ["DUE", "FAILED", "PROCESSING"];

/**
 * Everything the order page derives from the order and the viewer, computed once and shared by the header,
 * the "Your next step" card and the tabs. Only presentation: the services enforce every rule again.
 */
export function orderView(order, actor) {
  const isBrand = actor.id === order.brandId;
  const isFactory = actor.id === order.manufacturerId;
  const isAdmin = actor.role === "ADMIN";
  const closed = ["DELIVERED", "CANCELLED"].includes(order.status);
  const current = order.milestones.find((m) => m.stage === order.currentStage);
  const gate = STAGE_BY_KEY[order.currentStage].gate;
  const estimate = closed ? null : estimateDelivery(order.expectedCompletionDate, current);
  const slipped = !!estimate && estimate > order.expectedCompletionDate;
  const pendingSample = order.samples.find((s) => s.status === "SUBMITTED");
  const pendingQc = order.qcReports.find((r) => r.result === "PASS" && r.brandDecision === "PENDING");
  const openRework = order.reworkTasks.filter((r) => r.status === "OPEN");
  const paymentsLocked = order.paymentMilestones.some((p) => ["PROCESSING", "PAID", "REFUNDED"].includes(p.status));
  const factoryName = order.manufacturer.manufacturerProfile?.businessName ?? order.manufacturer.name;
  const brandName = order.brand.brandProfile?.companyName ?? order.brand.name;
  const location = order.manufacturer.manufacturerProfile
    ? `${order.manufacturer.manufacturerProfile.city}, ${order.manufacturer.manufacturerProfile.country}`
    : null;
  const doneCount = order.milestones.filter((m) => m.status === "COMPLETED").length;
  const currentOverdue = current && !closed ? daysOverdue(current.plannedEnd, current.completedAt) : 0;
  const currentLate = !!current && !closed && (current.isDelayed || currentOverdue > 0);

  /** Due or failed payments (the brand's attention items). */
  const due = order.paymentMilestones.filter((p) => p.status === "DUE" || p.status === "FAILED");
  /** Payments the brand can pay now (due, failed, or a checkout still processing). */
  const payable = isBrand ? order.paymentMilestones.filter((p) => PAYABLE_STATUSES.includes(p.status)) : [];
  const firstPayable = payable[0]?.id;

  /** True when the viewer has to act on the current production stage (the stage gate is theirs). */
  const hasStageTask =
    !closed &&
    !!current &&
    ((gate === "evidence" && isFactory) ||
      (gate === "sample" && ((isFactory && !pendingSample) || (isBrand && !!pendingSample))) ||
      (gate === "qc" && (((isFactory || isAdmin) && !pendingQc) || (isBrand && !!pendingQc))) ||
      (gate === "shipment" && isFactory) ||
      (gate === "delivery" && isBrand));

  return {
    isBrand,
    isFactory,
    isAdmin,
    closed,
    current,
    gate,
    estimate,
    slipped,
    pendingSample,
    pendingQc,
    openRework,
    paymentsLocked,
    factoryName,
    brandName,
    location,
    doneCount,
    currentOverdue,
    currentLate,
    due,
    payable,
    firstPayable,
    hasStageTask,
  };
}
