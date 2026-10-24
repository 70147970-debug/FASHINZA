import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { InquiryStatus, Role, UserStatus, VerificationStatus } from "@/generated/prisma/enums";
import type { Actor } from "@/server/actor";
import { assertRole } from "@/server/access";
import { notFound } from "@/server/errors";
import { audit } from "@/server/events";

const page = (p?: number) => Math.max(1, p ?? 1);
const pages = (total: number, size: number) => Math.max(1, Math.ceil(total / size));

export async function listUsers(actor: Actor, f: { q?: string; role?: Role; status?: UserStatus; page?: number }) {
  assertRole(actor, "ADMIN");
  const size = 20;
  const where: Prisma.UserWhereInput = {
    ...(f.role ? { role: f.role } : {}),
    ...(f.status ? { status: f.status } : {}),
    ...(f.q
      ? {
          OR: [
            { name: { contains: f.q, mode: "insensitive" } },
            { email: { contains: f.q, mode: "insensitive" } },
            { brandProfile: { companyName: { contains: f.q, mode: "insensitive" } } },
            { manufacturerProfile: { businessName: { contains: f.q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const [items, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page(f.page) - 1) * size,
      take: size,
      select: {
        id: true, name: true, email: true, role: true, status: true, statusReason: true, createdAt: true, lastLoginAt: true, profileCompleted: true,
        brandProfile: { select: { companyName: true } },
        manufacturerProfile: { select: { businessName: true, verificationStatus: true } },
      },
    }),
    db.user.count({ where }),
  ]);
  return { items, total, page: page(f.page), pages: pages(total, size) };
}

export async function listFactories(actor: Actor, f: { status?: VerificationStatus; q?: string; page?: number }) {
  assertRole(actor, "ADMIN");
  const size = 20;
  const where: Prisma.ManufacturerProfileWhereInput = {
    user: { profileCompleted: true },
    ...(f.status ? { verificationStatus: f.status } : {}),
    ...(f.q ? { businessName: { contains: f.q, mode: "insensitive" } } : {}),
  };
  const [items, total] = await Promise.all([
    db.manufacturerProfile.findMany({
      where,
      // Oldest pending requests first so the queue is worked in order.
      orderBy: [{ verificationRequestedAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
      skip: (page(f.page) - 1) * size,
      take: size,
      include: { _count: { select: { documents: true } }, user: { select: { email: true, status: true } } },
    }),
    db.manufacturerProfile.count({ where }),
  ]);
  return { items, total, page: page(f.page), pages: pages(total, size) };
}

export async function getFactory(actor: Actor, id: string) {
  assertRole(actor, "ADMIN");
  const p = await db.manufacturerProfile.findUnique({
    where: { id },
    include: { capabilities: true, documents: { orderBy: { createdAt: "desc" } }, user: { select: { id: true, email: true, name: true, status: true, createdAt: true } } },
  });
  if (!p) throw notFound("Factory");
  const history = await db.auditLog.findMany({ where: { OR: [{ targetId: id }, { targetId: { in: p.documents.map((d) => d.id) } }] }, orderBy: { createdAt: "desc" }, include: { actor: { select: { name: true } } } });
  return { profile: p, history };
}

export async function qcOverview(actor: Actor) {
  assertRole(actor, "ADMIN");
  const [failed, rejectedByBrand, openRework, pendingDecisions] = await Promise.all([
    db.qCReport.findMany({ where: { result: "FAIL" }, orderBy: { createdAt: "desc" }, take: 25, include: { order: { select: { id: true, reference: true, project: { select: { name: true } } } } } }),
    db.qCReport.findMany({ where: { brandDecision: "REJECTED" }, orderBy: { decidedAt: "desc" }, take: 25, include: { order: { select: { id: true, reference: true, project: { select: { name: true } } } } } }),
    db.reworkTask.findMany({ where: { status: "OPEN" }, orderBy: { createdAt: "asc" }, include: { order: { select: { id: true, reference: true, project: { select: { name: true } } } } } }),
    db.qCReport.count({ where: { result: "PASS", brandDecision: "PENDING" } }),
  ]);
  return { failed, rejectedByBrand, openRework, pendingDecisions };
}

export async function paymentOverview(actor: Actor, f: { page?: number }) {
  assertRole(actor, "ADMIN");
  const size = 25;
  const [events, eventTotal, refundable] = await Promise.all([
    db.webhookEvent.findMany({ orderBy: { createdAt: "desc" }, skip: (page(f.page) - 1) * size, take: size }),
    db.webhookEvent.count(),
    db.paymentMilestone.findMany({
      where: { status: { in: ["PAID", "PROCESSING", "FAILED"] } },
      orderBy: { updatedAt: "desc" },
      take: 50,
      include: { order: { select: { id: true, reference: true } }, transactions: { orderBy: { createdAt: "desc" } } },
    }),
  ]);
  return { events, refundable, page: page(f.page), pages: pages(eventTotal, size), total: eventTotal };
}

export async function listAudit(actor: Actor, f: { targetType?: string; q?: string; page?: number }) {
  assertRole(actor, "ADMIN");
  const size = 30;
  const where: Prisma.AuditLogWhereInput = {
    ...(f.targetType ? { targetType: f.targetType } : {}),
    ...(f.q ? { OR: [{ action: { contains: f.q, mode: "insensitive" } }, { reason: { contains: f.q, mode: "insensitive" } }, { targetId: f.q }] } : {}),
  };
  const [items, total, types] = await Promise.all([
    db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page(f.page) - 1) * size, take: size, include: { actor: { select: { name: true, email: true } } } }),
    db.auditLog.count({ where }),
    db.auditLog.findMany({ distinct: ["targetType"], select: { targetType: true } }),
  ]);
  return { items, total, page: page(f.page), pages: pages(total, size), types: types.map((t) => t.targetType) };
}

export async function listEnquiries(actor: Actor, f: { status?: InquiryStatus; page?: number }) {
  assertRole(actor, "ADMIN");
  const size = 20;
  const where: Prisma.ContactInquiryWhereInput = f.status ? { status: f.status } : {};
  const [items, total] = await Promise.all([
    db.contactInquiry.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page(f.page) - 1) * size, take: size }),
    db.contactInquiry.count({ where }),
  ]);
  return { items, total, page: page(f.page), pages: pages(total, size) };
}

export async function setEnquiryStatus(actor: Actor, id: string, status: InquiryStatus) {
  assertRole(actor, "ADMIN");
  await db.$transaction(async (tx) => {
    const e = await tx.contactInquiry.findUnique({ where: { id } });
    if (!e) throw notFound("Enquiry");
    await tx.contactInquiry.update({ where: { id }, data: { status } });
    await audit(tx, { actorId: actor.id, action: "ENQUIRY_STATUS_CHANGED", targetType: "ContactInquiry", targetId: id, metadata: { from: e.status, to: status } });
  });
}
