import type { Prisma } from "@/generated/prisma/client";
import type { Role } from "@/generated/prisma/enums";
import type { Actor } from "./actor";
import { forbidden } from "./errors";

/**
 * Tenant isolation. Every query for business records is scoped with one of these filters,
 * so a brand only reaches its own records and a manufacturer only reaches projects it was
 * matched to or quoted on, and orders it is producing. Admins see everything.
 */

export function assertRole(actor: Actor, ...roles: Role[]) {
  if (!roles.includes(actor.role)) throw forbidden();
}

export function projectScope(actor: Actor): Prisma.ProjectWhereInput {
  switch (actor.role) {
    case "ADMIN":
      return {};
    case "BRAND":
      return { brandId: actor.id };
    case "MANUFACTURER":
      return {
        status: { not: "DRAFT" },
        OR: [{ matchResults: { some: { manufacturerId: actor.id } } }, { quotations: { some: { manufacturerId: actor.id } } }],
      };
  }
}

export function orderScope(actor: Actor): Prisma.OrderWhereInput {
  switch (actor.role) {
    case "ADMIN":
      return {};
    case "BRAND":
      return { brandId: actor.id };
    case "MANUFACTURER":
      return { manufacturerId: actor.id };
  }
}

export function quotationScope(actor: Actor): Prisma.QuotationWhereInput {
  switch (actor.role) {
    case "ADMIN":
      return {};
    case "BRAND":
      // Brands never see a manufacturer's unsent drafts.
      return { project: { brandId: actor.id }, status: { not: "DRAFT" } };
    case "MANUFACTURER":
      return { manufacturerId: actor.id };
  }
}

export function disputeScope(actor: Actor): Prisma.IssueReportWhereInput {
  if (actor.role === "ADMIN") return {};
  return {
    OR: [
      { reporterId: actor.id },
      { order: orderScope(actor) },
      ...(actor.role === "BRAND" ? [{ project: { brandId: actor.id } }] : []),
    ],
  };
}
