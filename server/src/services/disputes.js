/**
 * Disputes (issue reports) between order participants, resolved by admins
 * (port of src/server/services/disputes.ts).
 */
import { withTransaction } from "../db.js";
import { assertRole, disputeFilter, orderFilter, projectFilter } from "../lib/access.js";
import { conflict, invalid, notFound } from "../lib/errors.js";
import { audit, logActivity, notify, notifyAdmins } from "../lib/events.js";
import { idOf, toObjectId } from "../lib/ids.js";
import { mapById } from "../lib/relations.js";
import { serialize } from "../lib/serialize.js";
import { IssueReport, Order, Project, User } from "../models/index.js";

/**
 * @param {{ orderId?: string, projectId?: string, category: string, subject: string, description: string }} input
 */
export async function raiseDispute(actor, input) {
  assertRole(actor, "BRAND", "MANUFACTURER");
  if (!input.orderId && !input.projectId) throw invalid("Choose the order or project this dispute is about.", { orderId: "Choose an order." });
  return withTransaction(async (session) => {
    let counterpart = null;
    let projectId = input.projectId ? toObjectId(input.projectId) : null;
    let orderId = null;
    let orderRef = "";
    if (input.orderId) {
      orderId = toObjectId(input.orderId);
      const order = orderId ? await Order.findOne({ $and: [{ _id: orderId }, orderFilter(actor)] }).session(session).lean() : null;
      if (!order) throw notFound("Order");
      counterpart = actor.id === idOf(order.brandId) ? order.manufacturerId : order.brandId;
      projectId = order.projectId;
      orderRef = order.reference;
    } else if (input.projectId) {
      const project = projectId ? await Project.findOne({ $and: [{ _id: projectId }, await projectFilter(actor, session)] }).session(session).lean() : null;
      if (!project) throw notFound("Project");
      counterpart = actor.role === "MANUFACTURER" ? project.brandId : null;
    }
    const [issue] = await IssueReport.create(
      [{ reporterId: toObjectId(actor.id), orderId, projectId, category: input.category, subject: input.subject, description: input.description }],
      { session },
    );
    const id = idOf(issue._id);
    const where = orderRef ? `order ${orderRef}` : "a project";
    await notifyAdmins(session, "DISPUTE_UPDATE", "New dispute", `${input.subject} (${where}).`, `/admin/disputes/${id}`);
    if (counterpart) {
      await notify(session, counterpart, "DISPUTE_UPDATE", "Dispute raised", `A dispute was raised on ${where}: ${input.subject}. The Fashinza team will review it.`, `/disputes/${id}`);
    }
    if (input.orderId) await logActivity(session, { actorId: actor.id, orderId, projectId, type: "DISPUTE_RAISED", message: `Dispute raised: ${input.subject}` });
    return serialize(IssueReport, issue);
  });
}

/**
 * @param {{ status: string, adminNote?: string, resolution?: string }} input
 */
export async function updateDispute(actor, id, input) {
  assertRole(actor, "ADMIN");
  await withTransaction(async (session) => {
    const oid = toObjectId(id);
    const issue = oid ? await IssueReport.findById(oid).session(session).lean() : null;
    if (!issue) throw notFound("Dispute");
    const order = issue.orderId ? await Order.findById(issue.orderId, { brandId: 1, manufacturerId: 1, reference: 1 }).session(session).lean() : null;
    const project = issue.projectId ? await Project.findById(issue.projectId, { brandId: 1 }).session(session).lean() : null;
    if (issue.status === "CLOSED") throw conflict("Closed disputes cannot be changed.");
    const closing = input.status === "RESOLVED" || input.status === "CLOSED";
    await IssueReport.updateOne(
      { _id: oid },
      {
        $set: {
          status: input.status,
          adminNote: input.adminNote ?? issue.adminNote ?? null,
          resolution: input.resolution ?? issue.resolution ?? null,
          resolvedAt: closing ? (issue.resolvedAt ?? new Date()) : null,
        },
      },
      { session },
    );
    const hex = idOf(oid);
    await audit(session, {
      actorId: actor.id,
      action: "DISPUTE_UPDATED",
      targetType: "IssueReport",
      targetId: hex,
      reason: input.resolution ?? input.adminNote,
      metadata: { from: issue.status, to: input.status },
    });
    const parties = new Set([issue.reporterId, order?.brandId, order?.manufacturerId, project?.brandId].filter(Boolean).map(idOf));
    const statusText = input.status.replace("_", " ").toLowerCase();
    await notify(
      session,
      [...parties],
      "DISPUTE_UPDATE",
      `Dispute ${statusText}`,
      `“${issue.subject}” is now ${statusText}.${input.resolution ? ` Resolution: ${input.resolution}` : ""}`,
      `/disputes/${hex}`,
    );
  });
}

/** Attaches reporter / order / project selections to issue reports. */
async function withRelations(issues, reporterFields) {
  const [reporters, orders, projects] = await Promise.all([
    mapById(User, issues.map((i) => i.reporterId), Object.fromEntries(reporterFields.map((f) => [f, 1]))),
    mapById(Order, issues.map((i) => i.orderId).filter(Boolean), { reference: 1 }),
    mapById(Project, issues.map((i) => i.projectId).filter(Boolean), { name: 1 }),
  ]);
  return issues.map((i) => {
    const r = reporters.get(idOf(i.reporterId));
    const o = i.orderId ? orders.get(idOf(i.orderId)) : null;
    const p = i.projectId ? projects.get(idOf(i.projectId)) : null;
    return {
      ...serialize(IssueReport, i),
      reporter: r ? Object.fromEntries(reporterFields.map((f) => [f, r[f]])) : null,
      order: o ? { id: idOf(o._id), reference: o.reference } : null,
      project: p ? { id: idOf(p._id), name: p.name } : null,
    };
  });
}

/** @param {{ status?: string, page?: number, pageSize?: number }} [f] */
export async function listDisputes(actor, f = {}) {
  const pageSize = Math.min(f.pageSize ?? 10, 50);
  const page = Math.max(1, f.page ?? 1);
  const where = { $and: [await disputeFilter(actor), f.status ? { status: f.status } : {}] };
  const [issues, total] = await Promise.all([
    IssueReport.find(where)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    IssueReport.countDocuments(where),
  ]);
  const items = await withRelations(issues, ["name", "role"]);
  return { items, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getDispute(actor, id) {
  const oid = toObjectId(id);
  const issue = oid ? await IssueReport.findOne({ $and: [{ _id: oid }, await disputeFilter(actor)] }).lean() : null;
  if (!issue) throw notFound("Dispute");
  const [withRels] = await withRelations([issue], ["name", "role", "email"]);
  return withRels;
}
