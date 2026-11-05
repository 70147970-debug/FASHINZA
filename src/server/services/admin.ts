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
        manufacturerProfile: { select: { id: true, businessName: true, verificationStatus: true } },
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

/** Factories per verification status (same scope and search as listFactories), for the queue's tab counts. */
export async function countFactoriesByStatus(actor: Actor, f: { q?: string } = {}) {
  assertRole(actor, "ADMIN");
  const rows = await db.manufacturerProfile.groupBy({
    by: ["verificationStatus"],
    where: { user: { profileCompleted: true }, ...(f.q ? { businessName: { contains: f.q, mode: "insensitive" } } : {}) },
    _count: true,
  });
  return Object.fromEntries(rows.map((r) => [r.verificationStatus, r._count])) as Partial<Record<VerificationStatus, number>>;
}

export async function getFactory(actor: Actor, id: string) {
  assertRole(actor, "ADMIN");
  const p = await db.manufacturerProfile.findUnique({
    where: { id },
    include: { capabilities: true, documents: { orderBy: { createdAt: "desc" } }, user: { select: { id: true, email: true, name: true, status: true, statusReason: true, createdAt: true } } },
  });
  if (!p) throw notFound("Factory");
  // Decisions on the factory, its documents and its account (suspensions), newest first.
  const entries = await db.auditLog.findMany({
    where: { OR: [{ targetId: id }, { targetId: p.user.id }, { targetId: { in: p.documents.map((d) => d.id) } }] },
    orderBy: { createdAt: "desc" },
    include: { actor: { select: { name: true } } },
  });
  const targets = await resolveAuditTargets(entries);
  const history = entries.map((e) => ({ ...e, target: targets[e.targetId] }));
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

export async function paymentOverview(actor: Actor, f: { page?: number; errorsOnly?: boolean }) {
  assertRole(actor, "ADMIN");
  const size = 25;
  // Same condition as the overview's "Unprocessed webhook errors" count.
  const eventWhere: Prisma.WebhookEventWhereInput = f.errorsOnly ? { error: { not: null }, processedAt: null } : {};
  const [events, eventTotal, refundable] = await Promise.all([
    db.webhookEvent.findMany({ where: eventWhere, orderBy: { createdAt: "desc" }, skip: (page(f.page) - 1) * size, take: size }),
    db.webhookEvent.count({ where: eventWhere }),
    db.paymentMilestone.findMany({
      where: { status: { in: ["PAID", "PROCESSING", "FAILED"] } },
      orderBy: { updatedAt: "desc" },
      take: 50,
      include: {
        order: { select: { id: true, reference: true, project: { select: { name: true } }, brand: { select: { name: true, brandProfile: { select: { companyName: true } } } } } },
        transactions: { orderBy: { createdAt: "desc" } },
      },
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
  const targets = await resolveAuditTargets(items);
  return {
    items: items.map((i) => ({ ...i, target: targets[i.targetId] })),
    total,
    page: page(f.page),
    pages: pages(total, size),
    types: types.map((t) => t.targetType),
  };
}

/** What an audit entry was about, in words, and where the admin can open it. */
export type AuditTarget = { name?: string; href?: string };

const metaString = (m: Prisma.JsonValue | null | undefined, key: string) => {
  const v = m && typeof m === "object" && !Array.isArray(m) ? (m as Record<string, Prisma.JsonValue>)[key] : undefined;
  return typeof v === "string" && v ? v : undefined;
};

/**
 * Names the records behind audit entries (read-only): one batched query per record type. Falls back to what
 * the entry's metadata recorded when the record no longer exists. Keyed by targetId (ids are unique cuids).
 */
export async function resolveAuditTargets(items: { targetType: string; targetId: string; metadata?: Prisma.JsonValue | null }[]): Promise<Record<string, AuditTarget>> {
  const ids = (type: string) => [...new Set(items.filter((i) => i.targetType === type).map((i) => i.targetId))];
  const userIds = ids("User");
  const profileIds = ids("ManufacturerProfile");
  const documentIds = ids("ManufacturerDocument");
  const issueIds = ids("IssueReport");
  const milestoneIds = ids("PaymentMilestone");
  const inquiryIds = ids("ContactInquiry");
  const [users, profiles, documents, issues, milestones, inquiries] = await Promise.all([
    userIds.length
      ? db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, manufacturerProfile: { select: { id: true, businessName: true } }, brandProfile: { select: { companyName: true } } } })
      : [],
    profileIds.length ? db.manufacturerProfile.findMany({ where: { id: { in: profileIds } }, select: { id: true, businessName: true } }) : [],
    documentIds.length
      ? db.manufacturerDocument.findMany({ where: { id: { in: documentIds } }, select: { id: true, fileName: true, certificationName: true, profile: { select: { id: true, businessName: true } } } })
      : [],
    issueIds.length ? db.issueReport.findMany({ where: { id: { in: issueIds } }, select: { id: true, subject: true } }) : [],
    milestoneIds.length ? db.paymentMilestone.findMany({ where: { id: { in: milestoneIds } }, select: { id: true, label: true, order: { select: { id: true, reference: true } } } }) : [],
    inquiryIds.length ? db.contactInquiry.findMany({ where: { id: { in: inquiryIds } }, select: { id: true, name: true, subject: true } }) : [],
  ]);
  const out: Record<string, AuditTarget> = {};
  for (const u of users) {
    const org = u.manufacturerProfile?.businessName ?? u.brandProfile?.companyName;
    out[u.id] = {
      name: org ? `${u.name} (${org})` : u.name,
      href: u.manufacturerProfile ? `/admin/factories/${u.manufacturerProfile.id}` : `/admin/users?q=${encodeURIComponent(u.name)}`,
    };
  }
  for (const p of profiles) out[p.id] = { name: p.businessName, href: `/admin/factories/${p.id}` };
  for (const d of documents) out[d.id] = { name: `${d.certificationName ?? d.fileName} · ${d.profile.businessName}`, href: `/admin/factories/${d.profile.id}` };
  for (const i of issues) out[i.id] = { name: i.subject, href: `/disputes/${i.id}` };
  for (const m of milestones) out[m.id] = { name: `${m.order.reference} · ${m.label}`, href: `/orders/${m.order.id}?tab=payments` };
  for (const q of inquiries) out[q.id] = { name: `${q.subject} (${q.name})`, href: "/admin/enquiries" };
  // Deleted records: fall back to what the entry itself recorded.
  for (const i of items) {
    if (out[i.targetId]) continue;
    const file = metaString(i.metadata, "certification") ?? metaString(i.metadata, "fileName");
    const amount = metaString(i.metadata, "amount");
    const currency = metaString(i.metadata, "currency");
    const name = file ?? (amount && currency ? `${currency} ${amount}` : undefined);
    if (name) out[i.targetId] = { name };
  }
  return out;
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
