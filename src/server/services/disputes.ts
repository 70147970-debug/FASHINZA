import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { IssueCategory, IssueStatus } from "@/generated/prisma/enums";
import type { Actor } from "@/server/actor";
import { assertRole, disputeScope, orderScope, projectScope } from "@/server/access";
import { conflict, invalid, notFound } from "@/server/errors";
import { audit, logActivity, notify, notifyAdmins } from "@/server/events";

export async function raiseDispute(
  actor: Actor,
  input: { orderId?: string; projectId?: string; category: IssueCategory; subject: string; description: string },
) {
  assertRole(actor, "BRAND", "MANUFACTURER");
  if (!input.orderId && !input.projectId) throw invalid("Choose the order or project this dispute is about.", { orderId: "Choose an order." });
  return db.$transaction(async (tx) => {
    let counterpart: string | null = null;
    let projectId = input.projectId;
    let orderRef = "";
    if (input.orderId) {
      const order = await tx.order.findFirst({ where: { id: input.orderId, ...orderScope(actor) } });
      if (!order) throw notFound("Order");
      counterpart = actor.id === order.brandId ? order.manufacturerId : order.brandId;
      projectId = order.projectId;
      orderRef = order.reference;
    } else if (projectId) {
      const project = await tx.project.findFirst({ where: { id: projectId, ...projectScope(actor) } });
      if (!project) throw notFound("Project");
      counterpart = actor.role === "MANUFACTURER" ? project.brandId : null;
    }
    const issue = await tx.issueReport.create({ data: { reporterId: actor.id, orderId: input.orderId, projectId, category: input.category, subject: input.subject, description: input.description } });
    const where = orderRef ? `order ${orderRef}` : "a project";
    await notifyAdmins(tx, "DISPUTE_UPDATE", "New dispute", `${input.subject} (${where}).`, `/admin/disputes/${issue.id}`);
    if (counterpart) await notify(tx, counterpart, "DISPUTE_UPDATE", "Dispute raised", `A dispute was raised on ${where}: ${input.subject}. The Fashinza team will review it.`, `/disputes/${issue.id}`);
    if (input.orderId) await logActivity(tx, { actorId: actor.id, orderId: input.orderId, projectId, type: "DISPUTE_RAISED", message: `Dispute raised: ${input.subject}` });
    return issue;
  });
}

export async function updateDispute(actor: Actor, id: string, input: { status: IssueStatus; adminNote?: string; resolution?: string }) {
  assertRole(actor, "ADMIN");
  await db.$transaction(async (tx) => {
    const issue = await tx.issueReport.findUnique({ where: { id }, include: { order: { select: { brandId: true, manufacturerId: true, reference: true } }, project: { select: { brandId: true } } } });
    if (!issue) throw notFound("Dispute");
    if (issue.status === "CLOSED") throw conflict("Closed disputes cannot be changed.");
    const closing = input.status === "RESOLVED" || input.status === "CLOSED";
    await tx.issueReport.update({
      where: { id },
      data: { status: input.status, adminNote: input.adminNote ?? issue.adminNote, resolution: input.resolution ?? issue.resolution, resolvedAt: closing ? issue.resolvedAt ?? new Date() : null },
    });
    await audit(tx, { actorId: actor.id, action: "DISPUTE_UPDATED", targetType: "IssueReport", targetId: id, reason: input.resolution ?? input.adminNote, metadata: { from: issue.status, to: input.status } });
    const parties = new Set([issue.reporterId, issue.order?.brandId, issue.order?.manufacturerId, issue.project?.brandId].filter((x): x is string => !!x));
    const statusText = input.status.replace("_", " ").toLowerCase();
    await notify(tx, [...parties], "DISPUTE_UPDATE", `Dispute ${statusText}`, `“${issue.subject}” is now ${statusText}.${input.resolution ? ` Resolution: ${input.resolution}` : ""}`, `/disputes/${id}`);
  });
}

export async function listDisputes(actor: Actor, f: { status?: IssueStatus; page?: number; pageSize?: number } = {}) {
  const pageSize = Math.min(f.pageSize ?? 10, 50);
  const page = Math.max(1, f.page ?? 1);
  const where: Prisma.IssueReportWhereInput = { AND: [disputeScope(actor), f.status ? { status: f.status } : {}] };
  const [items, total] = await Promise.all([
    db.issueReport.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { reporter: { select: { name: true, role: true } }, order: { select: { id: true, reference: true } }, project: { select: { id: true, name: true } } },
    }),
    db.issueReport.count({ where }),
  ]);
  return { items, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getDispute(actor: Actor, id: string) {
  const issue = await db.issueReport.findFirst({
    where: { id, ...disputeScope(actor) },
    include: { reporter: { select: { name: true, role: true, email: true } }, order: { select: { id: true, reference: true } }, project: { select: { id: true, name: true } } },
  });
  if (!issue) throw notFound("Dispute");
  return issue;
}
