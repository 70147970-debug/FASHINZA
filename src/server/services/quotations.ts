import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { calculateQuotationTotals } from "@/lib/quotation-math";
import type { QuotationInput } from "@/lib/validation/quotation";
import type { Actor } from "@/server/actor";
import { assertRole, quotationScope } from "@/server/access";
import { conflict, invalid, notFound } from "@/server/errors";
import { logActivity, notify } from "@/server/events";
import { createOrderFromQuotation } from "./orders";

const OPEN = ["SUBMITTED", "REVISION_REQUESTED"] as const;

/** Lazily expires open quotations whose validity has passed. Safe to call on every read. */
export async function expireQuotations(where: Prisma.QuotationWhereInput = {}) {
  await db.quotation.updateMany({ where: { ...where, status: { in: [...OPEN, "DRAFT"] }, validUntil: { lt: new Date() } }, data: { status: "EXPIRED" } });
}

function snapshot(q: { quantity: number; unitPrice: unknown; fabricCostPerUnit: unknown; finishingCostPerUnit: unknown; packagingCostPerUnit: unknown; samplingCost: unknown; logisticsCost: unknown; taxPercent: unknown; subtotal: unknown; taxAmount: unknown; totalAmount: unknown; minQuantity: number; productionDays: number; validUntil: Date; notes: string | null; currency: string }) {
  const s = (v: unknown) => (v === null || v === undefined ? null : String(v));
  return {
    quantity: q.quantity, minQuantity: q.minQuantity, productionDays: q.productionDays, currency: q.currency,
    unitPrice: s(q.unitPrice), fabricCostPerUnit: s(q.fabricCostPerUnit), finishingCostPerUnit: s(q.finishingCostPerUnit), packagingCostPerUnit: s(q.packagingCostPerUnit),
    samplingCost: s(q.samplingCost), logisticsCost: s(q.logisticsCost), taxPercent: s(q.taxPercent), subtotal: s(q.subtotal), taxAmount: s(q.taxAmount), totalAmount: s(q.totalAmount),
    validUntil: q.validUntil.toISOString(), notes: q.notes,
  };
}

/**
 * Manufacturer saves (submit = false) or sends (submit = true) a quotation. Totals are always
 * calculated here, never trusted from the browser. Re-sending a quotation the brand has already
 * seen bumps the version and archives the previous terms in QuotationRevision.
 */
export async function saveQuotation(actor: Actor, projectId: string, input: QuotationInput, submit: boolean) {
  assertRole(actor, "MANUFACTURER");
  const totals = calculateQuotationTotals(input);
  return db.$transaction(async (tx) => {
    const match = await tx.matchResult.findUnique({ where: { projectId_manufacturerId: { projectId, manufacturerId: actor.id } } });
    if (!match) throw notFound("Opportunity");
    const profile = await tx.manufacturerProfile.findUnique({ where: { userId: actor.id }, select: { verificationStatus: true } });
    if (profile?.verificationStatus !== "VERIFIED") throw conflict("Only verified factories can send quotations.");
    const project = await tx.project.findUniqueOrThrow({ where: { id: projectId } });
    if (!["SUBMITTED", "QUOTING"].includes(project.status)) throw conflict("This project is no longer accepting quotations.");

    const data = {
      quantity: input.quantity,
      unitPrice: input.unitPrice,
      fabricCostPerUnit: input.fabricCostPerUnit,
      finishingCostPerUnit: input.finishingCostPerUnit,
      packagingCostPerUnit: input.packagingCostPerUnit,
      samplingCost: input.samplingCost,
      logisticsCost: input.logisticsCost,
      taxPercent: input.taxPercent,
      subtotal: totals.subtotal,
      taxAmount: totals.taxAmount,
      totalAmount: totals.totalAmount,
      currency: project.currency,
      minQuantity: input.minQuantity,
      productionDays: input.productionDays,
      validUntil: input.validUntil,
      notes: input.notes ?? null,
    };

    const existing = await tx.quotation.findUnique({ where: { projectId_manufacturerId: { projectId, manufacturerId: actor.id } } });
    if (!existing) {
      const q = await tx.quotation.create({ data: { ...data, projectId, manufacturerId: actor.id, status: submit ? "SUBMITTED" : "DRAFT", submittedAt: submit ? new Date() : null } });
      if (submit) await announceSubmission(tx, q.id, false);
      return q;
    }
    if (["ACCEPTED", "REJECTED", "WITHDRAWN"].includes(existing.status)) throw conflict(`This quotation was ${existing.status.toLowerCase()} and can no longer be changed.`);

    const seenByBrand = existing.submittedAt !== null;
    if (seenByBrand) {
      if (!submit) throw conflict("A sent quotation cannot go back to draft. Send the revised quotation instead.");
      await tx.quotationRevision.create({
        data: {
          quotationId: existing.id,
          version: existing.version,
          unitPrice: existing.unitPrice,
          minQuantity: existing.minQuantity,
          productionDays: existing.productionDays,
          samplingCost: existing.samplingCost,
          notes: existing.notes,
          validUntil: existing.validUntil,
          snapshot: snapshot(existing),
        },
      });
    }
    const q = await tx.quotation.update({
      where: { id: existing.id },
      data: {
        ...data,
        status: submit ? "SUBMITTED" : "DRAFT",
        version: seenByBrand ? existing.version + 1 : existing.version,
        submittedAt: submit ? new Date() : null,
        revisionRequest: submit ? null : existing.revisionRequest,
      },
    });
    if (submit) await announceSubmission(tx, q.id, seenByBrand);
    return q;
  });
}

async function announceSubmission(tx: Prisma.TransactionClient, quotationId: string, revised: boolean) {
  const q = await tx.quotation.findUniqueOrThrow({ where: { id: quotationId }, include: { project: true, manufacturer: { select: { manufacturerProfile: { select: { businessName: true } } } } } });
  const factory = q.manufacturer.manufacturerProfile?.businessName ?? "A factory";
  if (q.project.status === "SUBMITTED") await tx.project.update({ where: { id: q.projectId }, data: { status: "QUOTING" } });
  await notify(
    tx,
    q.project.brandId,
    revised ? "QUOTATION_REVISED" : "QUOTATION_RECEIVED",
    revised ? "Quotation revised" : "New quotation",
    `${factory} ${revised ? `sent version ${q.version} of their quotation` : "sent a quotation"} for “${q.project.name}”: ${q.currency} ${q.totalAmount.toFixed(2)} total.`,
    `/projects/${q.projectId}#quotations`,
  );
  await logActivity(tx, { actorId: q.manufacturerId, projectId: q.projectId, type: revised ? "QUOTATION_REVISED" : "QUOTATION_SUBMITTED", message: `${factory} ${revised ? `revised their quotation (v${q.version})` : "submitted a quotation"}: ${q.currency} ${q.totalAmount.toFixed(2)}.` });
}

async function brandQuotation(tx: Prisma.TransactionClient, actor: Actor, quotationId: string) {
  assertRole(actor, "BRAND");
  const q = await tx.quotation.findFirst({ where: { id: quotationId, project: { brandId: actor.id }, status: { not: "DRAFT" } }, include: { project: true } });
  if (!q) throw notFound("Quotation");
  return q;
}

export async function requestRevision(actor: Actor, quotationId: string, message: string) {
  await db.$transaction(async (tx) => {
    const q = await brandQuotation(tx, actor, quotationId);
    if (q.status !== "SUBMITTED") throw conflict("Revisions can only be requested on a submitted quotation.");
    await tx.quotation.update({ where: { id: q.id }, data: { status: "REVISION_REQUESTED", revisionRequest: message } });
    await notify(tx, q.manufacturerId, "QUOTATION_REVISION_REQUESTED", "Revision requested", `The brand asked you to revise your quotation for “${q.project.name}”: ${message}`, `/opportunities/${q.projectId}`);
    await logActivity(tx, { actorId: actor.id, projectId: q.projectId, type: "QUOTATION_REVISION_REQUESTED", message: `Revision requested on quotation v${q.version}: ${message}` });
  });
}

export async function rejectQuotation(actor: Actor, quotationId: string, reason: string) {
  await db.$transaction(async (tx) => {
    const q = await brandQuotation(tx, actor, quotationId);
    if (!(OPEN as readonly string[]).includes(q.status)) throw conflict("Only open quotations can be rejected.");
    await tx.quotation.update({ where: { id: q.id }, data: { status: "REJECTED", decidedAt: new Date(), revisionRequest: reason } });
    await notify(tx, q.manufacturerId, "QUOTATION_REJECTED", "Quotation declined", `Your quotation for “${q.project.name}” was declined: ${reason}`, `/opportunities/${q.projectId}`);
    await logActivity(tx, { actorId: actor.id, projectId: q.projectId, type: "QUOTATION_REJECTED", message: `Quotation v${q.version} declined: ${reason}` });
  });
}

export async function withdrawQuotation(actor: Actor, quotationId: string) {
  assertRole(actor, "MANUFACTURER");
  await db.$transaction(async (tx) => {
    const q = await tx.quotation.findFirst({ where: { id: quotationId, manufacturerId: actor.id }, include: { project: true } });
    if (!q) throw notFound("Quotation");
    if (!["DRAFT", ...OPEN].includes(q.status)) throw conflict("This quotation can no longer be withdrawn.");
    await tx.quotation.update({ where: { id: q.id }, data: { status: "WITHDRAWN", decidedAt: new Date() } });
    if (q.submittedAt) await notify(tx, q.project.brandId, "QUOTATION_REJECTED", "Quotation withdrawn", `A factory withdrew its quotation for “${q.project.name}”.`, `/projects/${q.projectId}#quotations`);
  });
}

/**
 * Accepting a quotation creates the order. The project row is locked so two acceptances
 * cannot race, the quotation must still be valid, and every other open quotation is closed.
 * Order.projectId is unique, so a duplicate order is impossible even if the lock were bypassed.
 */
export async function acceptQuotation(actor: Actor, quotationId: string) {
  assertRole(actor, "BRAND");
  // Expire outside the transaction: an update inside it would roll back with the error below.
  await expireQuotations({ id: quotationId });
  return db.$transaction(async (tx) => {
    const target = await tx.quotation.findFirst({ where: { id: quotationId, project: { brandId: actor.id }, status: { not: "DRAFT" } }, select: { projectId: true } });
    if (!target) throw notFound("Quotation");
    await tx.$queryRaw`SELECT id FROM "project" WHERE id = ${target.projectId} FOR UPDATE`;

    const q = await brandQuotation(tx, actor, quotationId);
    if (q.status === "EXPIRED" || q.validUntil < new Date()) throw conflict("This quotation has expired. Ask the factory to send a new one.");
    if (q.status !== "SUBMITTED") throw conflict(q.status === "REVISION_REQUESTED" ? "You asked for a revision. Wait for the factory to send the revised quotation." : "Only a submitted quotation can be accepted.");
    if (!["SUBMITTED", "QUOTING"].includes(q.project.status)) throw conflict("A quotation has already been accepted for this project.");
    const existingOrder = await tx.order.findUnique({ where: { projectId: q.projectId }, select: { id: true } });
    if (existingOrder) throw conflict("This project already has an order.");

    const now = new Date();
    await tx.quotation.update({ where: { id: q.id }, data: { status: "ACCEPTED", decidedAt: now } });
    const others = await tx.quotation.findMany({ where: { projectId: q.projectId, id: { not: q.id }, status: { in: ["DRAFT", ...OPEN] } }, select: { id: true, manufacturerId: true, submittedAt: true } });
    if (others.length) {
      await tx.quotation.updateMany({ where: { id: { in: others.map((o) => o.id) } }, data: { status: "REJECTED", decidedAt: now, revisionRequest: "Another quotation was accepted." } });
      const informed = others.filter((o) => o.submittedAt).map((o) => o.manufacturerId);
      if (informed.length) await notify(tx, informed, "QUOTATION_REJECTED", "Quotation not selected", `The brand accepted another quotation for “${q.project.name}”.`, `/opportunities/${q.projectId}`);
    }
    await tx.project.update({ where: { id: q.projectId }, data: { status: "IN_PRODUCTION" } });
    const order = await createOrderFromQuotation(tx, q.id, actor.id);
    await notify(tx, q.manufacturerId, "QUOTATION_ACCEPTED", "Quotation accepted", `Your quotation for “${q.project.name}” was accepted. Order ${order.reference} has started with fabric sourcing.`, `/orders/${order.id}`);
    await notify(tx, actor.id, "ORDER_CREATED", "Order created", `Order ${order.reference} for “${q.project.name}” is now in production.`, `/orders/${order.id}`);
    return order;
  }, { timeout: 20_000 });
}

export async function listProjectQuotations(actor: Actor, projectId: string) {
  await expireQuotations({ projectId });
  return db.quotation.findMany({
    where: { projectId, ...quotationScope(actor) },
    orderBy: [{ status: "asc" }, { totalAmount: "asc" }],
    include: {
      manufacturer: { select: { id: true, manufacturerProfile: { select: { businessName: true, city: true, country: true, verificationStatus: true } } } },
      revisions: { orderBy: { version: "desc" } },
    },
  });
}

export async function getMyQuotation(actor: Actor, projectId: string) {
  assertRole(actor, "MANUFACTURER");
  await expireQuotations({ projectId, manufacturerId: actor.id });
  return db.quotation.findUnique({ where: { projectId_manufacturerId: { projectId, manufacturerId: actor.id } }, include: { revisions: { orderBy: { version: "desc" } } } });
}

export async function getQuotationForActor(actor: Actor, quotationId: string) {
  const q = await db.quotation.findFirst({ where: { id: quotationId, ...quotationScope(actor) } });
  if (!q) throw notFound("Quotation");
  return q;
}

export function assertValidDecisionNote(note: string | undefined) {
  if (!note || note.trim().length < 5) throw invalid("Explain your decision in at least 5 characters.", { note: "Explain your decision in at least 5 characters." });
  return note.trim();
}
