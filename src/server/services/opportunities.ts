import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { QuotationStatus } from "@/generated/prisma/enums";
import type { Actor } from "@/server/actor";
import { assertRole } from "@/server/access";
import { notFound } from "@/server/errors";
import { expireQuotations } from "./quotations";

/** Projects this factory was matched to. "new" = still open and not yet quoted. */
export async function listOpportunities(actor: Actor, f: { filter?: "new" | "open" | "all"; q?: string; page?: number } = {}) {
  assertRole(actor, "MANUFACTURER");
  const pageSize = 10;
  const page = Math.max(1, f.page ?? 1);
  const where: Prisma.MatchResultWhereInput = {
    manufacturerId: actor.id,
    ...(f.q ? { project: { name: { contains: f.q, mode: "insensitive" } } } : {}),
    ...(f.filter === "new"
      ? { project: { status: { in: ["SUBMITTED", "QUOTING"] }, quotations: { none: { manufacturerId: actor.id } }, ...(f.q ? { name: { contains: f.q, mode: "insensitive" } } : {}) } }
      : f.filter === "open" || !f.filter
        ? { project: { status: { in: ["SUBMITTED", "QUOTING"] }, ...(f.q ? { name: { contains: f.q, mode: "insensitive" } } : {}) } }
        : {}),
  };
  const [items, total] = await Promise.all([
    db.matchResult.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        project: {
          select: {
            id: true, name: true, category: true, quantity: true, deadline: true, status: true, currency: true,
            brand: { select: { brandProfile: { select: { companyName: true, country: true } } } },
            quotations: { where: { manufacturerId: actor.id }, select: { status: true, totalAmount: true, version: true } },
          },
        },
      },
    }),
    db.matchResult.count({ where }),
  ]);
  return { items, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

/** Everything a matched factory needs to quote. Unmatched factories get "not found". */
export async function getOpportunity(actor: Actor, projectId: string) {
  assertRole(actor, "MANUFACTURER");
  const match = await db.matchResult.findUnique({ where: { projectId_manufacturerId: { projectId, manufacturerId: actor.id } } });
  if (!match) throw notFound("Opportunity");
  await expireQuotations({ projectId, manufacturerId: actor.id });
  const project = await db.project.findUniqueOrThrow({
    where: { id: projectId },
    include: {
      brand: { select: { brandProfile: { select: { companyName: true, country: true, description: true } } } },
      attachments: { orderBy: [{ kind: "asc" }, { version: "desc" }] },
      order: { select: { id: true, manufacturerId: true } },
      revisions: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });
  const quotation = await db.quotation.findUnique({ where: { projectId_manufacturerId: { projectId, manufacturerId: actor.id } }, include: { revisions: { orderBy: { version: "desc" } } } });
  const profile = await db.manufacturerProfile.findUnique({ where: { userId: actor.id }, select: { verificationStatus: true, typicalLeadTimeDays: true, minOrderQuantity: true } });
  return { match, project, quotation, profile };
}

export async function listMyQuotations(actor: Actor, f: { status?: QuotationStatus; page?: number } = {}) {
  assertRole(actor, "MANUFACTURER");
  await expireQuotations({ manufacturerId: actor.id });
  const pageSize = 10;
  const page = Math.max(1, f.page ?? 1);
  const where: Prisma.QuotationWhereInput = { manufacturerId: actor.id, ...(f.status ? { status: f.status } : {}) };
  const [items, total] = await Promise.all([
    db.quotation.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { project: { select: { id: true, name: true, category: true, order: { select: { id: true, manufacturerId: true } } } } },
    }),
    db.quotation.count({ where }),
  ]);
  return { items, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
}
