/**
 * Quotations (port of src/server/services/quotations.ts): manufacturer drafts and sends, brand decisions,
 * acceptance into an order, and lazy expiry.
 *
 * Acceptance: the PostgreSQL app locked the project row (SELECT … FOR UPDATE). Here the first write of the
 * transaction touches the project document, so a concurrent acceptance hits a MongoDB write conflict and is retried
 * by withTransaction against the committed state (where it then fails with the usual conflict message). The unique
 * index on orders.projectId is the final guarantee: never two orders for one project.
 */
import Decimal from "decimal.js";
import { QuotationStatus, enumRank } from "@fashinza/shared/enums.js";
import { calculateQuotationTotals } from "@fashinza/shared/quotation-math.js";
import { isDuplicateKeyError, isWriteConflict, withTransaction } from "../db.js";
import { assertRole, brandProjectIds, quotationFilter } from "../lib/access.js";
import { conflict, invalid, isAppError, notFound } from "../lib/errors.js";
import { logActivity, notify } from "../lib/events.js";
import { and, byId, compareDecimal, d128, decimalString, groupBy, oid, opts, s } from "../lib/records.js";
import { serialize } from "../lib/serialize.js";
import { ManufacturerProfile } from "../models/ManufacturerProfile.js";
import { MatchResult } from "../models/MatchResult.js";
import { Order } from "../models/Order.js";
import { Project } from "../models/Project.js";
import { Quotation } from "../models/Quotation.js";
import { QuotationRevision } from "../models/QuotationRevision.js";

const OPEN = ["SUBMITTED", "REVISION_REQUESTED"];

/**
 * Translates the Prisma-style filters callers pass ({ id }, { projectId }, { manufacturerId },
 * { project: { brandId } }) into a quotation filter.
 */
async function quotationWhere(where = {}) {
  /** @type {Record<string, unknown>} */
  const f = {};
  if (where.id !== undefined) f._id = oid(where.id);
  if (where.projectId !== undefined) f.projectId = oid(where.projectId);
  if (where.manufacturerId !== undefined) f.manufacturerId = oid(where.manufacturerId);
  if (where.project?.brandId !== undefined) {
    const ids = await brandProjectIds(oid(where.project.brandId));
    return and(f, { projectId: { $in: ids } });
  }
  return f;
}

/** Lazily expires open quotations whose validity has passed. Safe to call on every read. */
export async function expireQuotations(where = {}) {
  const filter = await quotationWhere(where);
  await Quotation.updateMany(and(filter, { status: { $in: [...OPEN, "DRAFT"] }, validUntil: { $lt: new Date() } }), { $set: { status: "EXPIRED" } });
}

/** The previous terms archived in QuotationRevision.snapshot (Decimal values as Prisma's toString()). */
export function snapshot(q) {
  const str = (v) => (v === null || v === undefined ? null : decimalString(v));
  return {
    quantity: q.quantity,
    minQuantity: q.minQuantity,
    productionDays: q.productionDays,
    currency: q.currency,
    unitPrice: str(q.unitPrice),
    fabricCostPerUnit: str(q.fabricCostPerUnit),
    finishingCostPerUnit: str(q.finishingCostPerUnit),
    packagingCostPerUnit: str(q.packagingCostPerUnit),
    samplingCost: str(q.samplingCost),
    logisticsCost: str(q.logisticsCost),
    taxPercent: str(q.taxPercent),
    subtotal: str(q.subtotal),
    taxAmount: str(q.taxAmount),
    totalAmount: str(q.totalAmount),
    validUntil: new Date(q.validUntil).toISOString(),
    notes: q.notes ?? null,
    sampleLeadTimeDays: q.sampleLeadTimeDays ?? null,
    sampleNotes: q.sampleNotes ?? null,
  };
}

const money2 = (v) => new Decimal(String(v)).toFixed(2);

/**
 * Manufacturer saves (submit = false) or sends (submit = true) a quotation. Totals are always
 * calculated here, never trusted from the browser. Re-sending a quotation the brand has already
 * seen bumps the version and archives the previous terms in QuotationRevision. When the brand asked
 * for samples, a sent quotation must include the sample lead time (the sample proposal).
 */
export async function saveQuotation(actor, projectId, input, submit) {
  assertRole(actor, "MANUFACTURER");
  const totals = calculateQuotationTotals(input);
  const manufacturerId = oid(actor.id);
  const pid = oid(projectId);
  return withTransaction(async (session) => {
    const match = await MatchResult.findOne({ projectId: pid, manufacturerId }, { _id: 1 }).session(s(session)).lean();
    if (!match) throw notFound("Opportunity");
    const profile = await ManufacturerProfile.findOne({ userId: manufacturerId }, { verificationStatus: 1 }).session(s(session)).lean();
    if (profile?.verificationStatus !== "VERIFIED") throw conflict("Only verified factories can send quotations.");
    const project = await Project.findById(pid).session(s(session)).orFail().lean();
    if (!["SUBMITTED", "QUOTING"].includes(project.status)) throw conflict("This project is no longer accepting quotations.");
    if (submit && project.sampleRequired && !input.sampleLeadTimeDays) {
      const message = "The brand asked for samples. Enter how many days you need to make them.";
      throw invalid(message, { sampleLeadTimeDays: message });
    }

    const data = {
      quantity: input.quantity,
      unitPrice: d128(input.unitPrice),
      fabricCostPerUnit: d128(input.fabricCostPerUnit),
      finishingCostPerUnit: d128(input.finishingCostPerUnit),
      packagingCostPerUnit: d128(input.packagingCostPerUnit),
      samplingCost: d128(input.samplingCost),
      logisticsCost: d128(input.logisticsCost),
      taxPercent: d128(input.taxPercent),
      subtotal: d128(totals.subtotal),
      taxAmount: d128(totals.taxAmount),
      totalAmount: d128(totals.totalAmount),
      currency: project.currency,
      minQuantity: input.minQuantity,
      productionDays: input.productionDays,
      validUntil: input.validUntil,
      notes: input.notes ?? null,
      sampleLeadTimeDays: input.sampleLeadTimeDays ?? null,
      sampleNotes: input.sampleNotes ?? null,
    };

    const existing = await Quotation.findOne({ projectId: pid, manufacturerId }).session(s(session)).lean();
    if (!existing) {
      const [q] = await Quotation.create(
        [{ ...data, projectId: pid, manufacturerId, status: submit ? "SUBMITTED" : "DRAFT", submittedAt: submit ? new Date() : null }],
        opts(session),
      );
      if (submit) await announceSubmission(session, q._id, false);
      return serialize(Quotation, q);
    }
    if (["ACCEPTED", "REJECTED", "WITHDRAWN"].includes(existing.status)) throw conflict(`This quotation was ${existing.status.toLowerCase()} and can no longer be changed.`);

    const seenByBrand = existing.submittedAt !== null && existing.submittedAt !== undefined;
    if (seenByBrand) {
      if (!submit) throw conflict("A sent quotation cannot go back to draft. Send the revised quotation instead.");
      await QuotationRevision.create(
        [
          {
            quotationId: existing._id,
            version: existing.version,
            unitPrice: existing.unitPrice,
            minQuantity: existing.minQuantity,
            productionDays: existing.productionDays,
            samplingCost: existing.samplingCost,
            notes: existing.notes,
            validUntil: existing.validUntil,
            snapshot: snapshot(existing),
          },
        ],
        opts(session),
      );
    }
    const q = await Quotation.findOneAndUpdate(
      { _id: existing._id },
      {
        $set: {
          ...data,
          status: submit ? "SUBMITTED" : "DRAFT",
          version: seenByBrand ? existing.version + 1 : existing.version,
          submittedAt: submit ? new Date() : null,
          revisionRequest: submit ? null : existing.revisionRequest,
        },
      },
      opts(session, { new: true }),
    ).lean();
    if (submit) await announceSubmission(session, q._id, seenByBrand);
    return serialize(Quotation, q);
  });
}

async function announceSubmission(session, quotationId, revised) {
  const q = await Quotation.findById(quotationId).session(s(session)).orFail().lean();
  const project = await Project.findById(q.projectId).session(s(session)).orFail().lean();
  const profile = await ManufacturerProfile.findOne({ userId: q.manufacturerId }, { businessName: 1 }).session(s(session)).lean();
  const factory = profile?.businessName ?? "A factory";
  const pid = project._id.toHexString();
  if (project.status === "SUBMITTED") await Project.updateOne({ _id: project._id }, { $set: { status: "QUOTING" } }, opts(session));
  const total = money2(q.totalAmount);
  await notify(
    session,
    project.brandId.toHexString(),
    revised ? "QUOTATION_REVISED" : "QUOTATION_RECEIVED",
    revised ? "Quotation revised" : "New quotation",
    `${factory} ${revised ? `sent version ${q.version} of their quotation` : "sent a quotation"} for “${project.name}”: ${q.currency} ${total} total.`,
    `/projects/${pid}?tab=quotations`,
  );
  await logActivity(session, {
    actorId: q.manufacturerId.toHexString(),
    projectId: pid,
    type: revised ? "QUOTATION_REVISED" : "QUOTATION_SUBMITTED",
    message: `${factory} ${revised ? `revised their quotation (v${q.version})` : "submitted a quotation"}: ${q.currency} ${total}.`,
  });
}

/** A sent quotation on one of the brand's projects, with its project (NOT_FOUND "Quotation" otherwise). */
async function brandQuotation(session, actor, quotationId) {
  assertRole(actor, "BRAND");
  const q = await Quotation.findOne({ _id: oid(quotationId), status: { $ne: "DRAFT" } }).session(s(session)).lean();
  const project = q ? await Project.findOne({ _id: q.projectId, brandId: oid(actor.id) }).session(s(session)).lean() : null;
  if (!q || !project) throw notFound("Quotation");
  return { ...q, project };
}

export async function requestRevision(actor, quotationId, message) {
  await withTransaction(async (session) => {
    const q = await brandQuotation(session, actor, quotationId);
    if (q.status !== "SUBMITTED") throw conflict("Revisions can only be requested on a submitted quotation.");
    const pid = q.projectId.toHexString();
    await Quotation.updateOne({ _id: q._id }, { $set: { status: "REVISION_REQUESTED", revisionRequest: message } }, opts(session));
    await notify(
      session,
      q.manufacturerId.toHexString(),
      "QUOTATION_REVISION_REQUESTED",
      "Revision requested",
      `The brand asked you to revise your quotation for “${q.project.name}”: ${message}`,
      `/opportunities/${pid}`,
    );
    await logActivity(session, { actorId: actor.id, projectId: pid, type: "QUOTATION_REVISION_REQUESTED", message: `Revision requested on quotation v${q.version}: ${message}` });
  });
}

export async function rejectQuotation(actor, quotationId, reason) {
  await withTransaction(async (session) => {
    const q = await brandQuotation(session, actor, quotationId);
    if (!OPEN.includes(q.status)) throw conflict("Only open quotations can be rejected.");
    const pid = q.projectId.toHexString();
    await Quotation.updateOne({ _id: q._id }, { $set: { status: "REJECTED", decidedAt: new Date(), revisionRequest: reason } }, opts(session));
    await notify(session, q.manufacturerId.toHexString(), "QUOTATION_REJECTED", "Quotation declined", `Your quotation for “${q.project.name}” was declined: ${reason}`, `/opportunities/${pid}`);
    await logActivity(session, { actorId: actor.id, projectId: pid, type: "QUOTATION_REJECTED", message: `Quotation v${q.version} declined: ${reason}` });
  });
}

export async function withdrawQuotation(actor, quotationId) {
  assertRole(actor, "MANUFACTURER");
  await withTransaction(async (session) => {
    const q = await Quotation.findOne({ _id: oid(quotationId), manufacturerId: oid(actor.id) }).session(s(session)).lean();
    if (!q) throw notFound("Quotation");
    if (!["DRAFT", ...OPEN].includes(q.status)) throw conflict("This quotation can no longer be withdrawn.");
    const project = await Project.findById(q.projectId, { brandId: 1, name: 1 }).session(s(session)).orFail().lean();
    await Quotation.updateOne({ _id: q._id }, { $set: { status: "WITHDRAWN", decidedAt: new Date() } }, opts(session));
    if (q.submittedAt) {
      await notify(
        session,
        project.brandId.toHexString(),
        "QUOTATION_REJECTED",
        "Quotation withdrawn",
        `A factory withdrew its quotation for “${project.name}”.`,
        `/projects/${q.projectId.toHexString()}?tab=quotations`,
      );
    }
  });
}

/** SERVER-B's createOrderFromQuotation, loaded on first use so this module also loads before orders.js exists. */
async function createOrderFromQuotation(session, quotationId, actorId) {
  const orders = await import("./orders.js");
  return orders.createOrderFromQuotation(session, quotationId, actorId);
}

/**
 * Accepting a quotation creates the order. Two acceptances cannot both succeed (see the module comment),
 * the quotation must still be valid, and every other open quotation is closed.
 * @returns {Promise<Record<string, unknown>>} the order (serialised)
 */
export async function acceptQuotation(actor, quotationId) {
  assertRole(actor, "BRAND");
  // Expire outside the transaction: an update inside it would roll back with the error below.
  await expireQuotations({ id: quotationId });
  try {
    const order = await withTransaction(async (session) => {
      const target = await Quotation.findOne({ _id: oid(quotationId), status: { $ne: "DRAFT" } }, { projectId: 1 }).session(s(session)).lean();
      const owned = target ? await Project.exists({ _id: target.projectId, brandId: oid(actor.id) }).session(s(session)) : null;
      if (!target || !owned) throw notFound("Quotation");
      // Takes the project's write lock for this transaction (the FOR UPDATE of the original).
      await Project.updateOne({ _id: target.projectId }, { $set: { updatedAt: new Date() } }, opts(session, { timestamps: false }));

      const q = await brandQuotation(session, actor, quotationId);
      if (q.status === "EXPIRED" || q.validUntil < new Date()) throw conflict("This quotation has expired. Ask the factory to send a new one.");
      if (q.status !== "SUBMITTED") {
        throw conflict(q.status === "REVISION_REQUESTED" ? "You asked for a revision. Wait for the factory to send the revised quotation." : "Only a submitted quotation can be accepted.");
      }
      if (!["SUBMITTED", "QUOTING"].includes(q.project.status)) throw conflict("A quotation has already been accepted for this project.");
      const existingOrder = await Order.exists({ projectId: q.projectId }).session(s(session));
      if (existingOrder) throw conflict("This project already has an order.");

      const now = new Date();
      const pid = q.projectId.toHexString();
      await Quotation.updateOne({ _id: q._id }, { $set: { status: "ACCEPTED", decidedAt: now } }, opts(session));
      const others = await Quotation.find({ projectId: q.projectId, _id: { $ne: q._id }, status: { $in: ["DRAFT", ...OPEN] } }, { _id: 1, manufacturerId: 1, submittedAt: 1 })
        .session(s(session))
        .lean();
      if (others.length) {
        await Quotation.updateMany(
          { _id: { $in: others.map((o) => o._id) } },
          { $set: { status: "REJECTED", decidedAt: now, revisionRequest: "Another quotation was accepted." } },
          opts(session),
        );
        const informed = others.filter((o) => o.submittedAt).map((o) => o.manufacturerId.toHexString());
        if (informed.length) {
          await notify(session, informed, "QUOTATION_REJECTED", "Quotation not selected", `The brand accepted another quotation for “${q.project.name}”.`, `/opportunities/${pid}`);
        }
      }
      await Project.updateOne({ _id: q.projectId }, { $set: { status: "IN_PRODUCTION" } }, opts(session));
      const created = serialize(Order, await createOrderFromQuotation(session, q._id.toHexString(), actor.id));
      await notify(
        session,
        q.manufacturerId.toHexString(),
        "QUOTATION_ACCEPTED",
        "Quotation accepted",
        `Your quotation for “${q.project.name}” was accepted. Order ${created.reference} has started with fabric sourcing.`,
        `/orders/${created.id}`,
      );
      await notify(session, actor.id, "ORDER_CREATED", "Order created", `Order ${created.reference} for “${q.project.name}” is now in production.`, `/orders/${created.id}`);
      return created;
    });
    return order;
  } catch (e) {
    if (isAppError(e)) throw e;
    // Unique order per project / per quotation: a concurrent acceptance already created the order.
    if (isDuplicateKeyError(e)) throw conflict("This project already has an order.");
    // A concurrent acceptance kept winning the project lock until the retries ran out.
    if (isWriteConflict(e)) throw conflict("A quotation has already been accepted for this project.");
    throw e;
  }
}

/**
 * Quotations on a project the actor may see (brands never see drafts), cheapest first within each status,
 * with the factory and the revision history.
 */
export async function listProjectQuotations(actor, projectId) {
  await expireQuotations({ projectId });
  const rows = await Quotation.find(and({ projectId: oid(projectId) }, await quotationFilter(actor))).lean();
  rows.sort((a, b) => enumRank(QuotationStatus, a.status) - enumRank(QuotationStatus, b.status) || compareDecimal(a.totalAmount, b.totalAmount) || String(a._id).localeCompare(String(b._id)));
  const manufacturerIds = rows.map((q) => q.manufacturerId);
  const [profiles, revisions] = rows.length
    ? await Promise.all([
        ManufacturerProfile.find({ userId: { $in: manufacturerIds } }, { userId: 1, businessName: 1, city: 1, country: 1, verificationStatus: 1 }).lean(),
        QuotationRevision.find({ quotationId: { $in: rows.map((q) => q._id) } }).sort({ version: -1 }).lean(),
      ])
    : [[], []];
  const profileByUser = byId(profiles, "userId");
  const revisionsByQuote = groupBy(revisions, "quotationId");
  return rows.map((q) => {
    const p = profileByUser.get(String(q.manufacturerId));
    return {
      ...serialize(Quotation, q),
      manufacturer: {
        id: q.manufacturerId.toHexString(),
        manufacturerProfile: p ? { businessName: p.businessName, city: p.city, country: p.country, verificationStatus: p.verificationStatus } : null,
      },
      revisions: serialize(QuotationRevision, revisionsByQuote.get(String(q._id)) ?? []),
    };
  });
}

/** The manufacturer's own quotation on a project with its revisions (newest version first), or null. */
export async function getMyQuotation(actor, projectId) {
  assertRole(actor, "MANUFACTURER");
  await expireQuotations({ projectId, manufacturerId: actor.id });
  const q = await Quotation.findOne({ projectId: oid(projectId), manufacturerId: oid(actor.id) }).lean();
  if (!q) return null;
  const revisions = await QuotationRevision.find({ quotationId: q._id }).sort({ version: -1 }).lean();
  return { ...serialize(Quotation, q), revisions: serialize(QuotationRevision, revisions) };
}

export async function getQuotationForActor(actor, quotationId) {
  const q = await Quotation.findOne(and({ _id: oid(quotationId) }, await quotationFilter(actor))).lean();
  if (!q) throw notFound("Quotation");
  return serialize(Quotation, q);
}

export function assertValidDecisionNote(note) {
  if (!note || note.trim().length < 5) throw invalid("Explain your decision in at least 5 characters.", { note: "Explain your decision in at least 5 characters." });
  return note.trim();
}
