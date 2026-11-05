/**
 * Manufacturer views (port of src/server/services/opportunities.ts): matched projects ("opportunities"), one
 * opportunity with everything needed to quote, and the factory's own quotation list.
 */
import { assertRole } from "../lib/access.js";
import { notFound } from "../lib/errors.js";
import { and, byId, groupBy, oid, sortAttachments } from "../lib/records.js";
import { containsInsensitive, serialize } from "../lib/serialize.js";
import { BrandProfile } from "../models/BrandProfile.js";
import { ManufacturerProfile } from "../models/ManufacturerProfile.js";
import { MatchResult } from "../models/MatchResult.js";
import { Order } from "../models/Order.js";
import { Project } from "../models/Project.js";
import { ProjectAttachment } from "../models/ProjectAttachment.js";
import { ProjectRevision } from "../models/ProjectRevision.js";
import { Quotation } from "../models/Quotation.js";
import { QuotationRevision } from "../models/QuotationRevision.js";
import { expireQuotations } from "./quotations.js";

const ACCEPTING = ["SUBMITTED", "QUOTING"];

/**
 * The match-result filter for listOpportunities. "new" = still open and not yet quoted; "open" (default) = still
 * accepting quotations; "all" = every match. `q` filters by project name (case-insensitive substring).
 */
async function opportunityWhere(manufacturerId, f) {
  const filter = f.filter === "new" || f.filter === "open" || f.filter === "all" ? f.filter : f.filter ? "all" : "open";
  const base = { manufacturerId };
  if (filter === "all" && !f.q) return base;
  const matchedProjectIds = await MatchResult.distinct("projectId", base);
  /** @type {Record<string, unknown>[]} */
  const conditions = [{ _id: { $in: matchedProjectIds } }];
  if (f.q) conditions.push({ name: containsInsensitive(f.q) });
  if (filter === "new" || filter === "open") conditions.push({ status: { $in: ACCEPTING } });
  if (filter === "new") {
    const quoted = await Quotation.distinct("projectId", { manufacturerId });
    conditions.push({ _id: { $nin: quoted } });
  }
  const projectIds = await Project.distinct("_id", and(...conditions));
  return { ...base, projectId: { $in: projectIds } };
}

/**
 * Projects this factory was matched to. "new" = still open and not yet quoted.
 * @param {{ id: string, role: string }} actor
 * @param {{ filter?: "new" | "open" | "all", q?: string, page?: number }} [f]
 */
export async function listOpportunities(actor, f = {}) {
  assertRole(actor, "MANUFACTURER");
  const pageSize = 10;
  const page = Math.max(1, f.page ?? 1);
  const manufacturerId = oid(actor.id);
  const where = await opportunityWhere(manufacturerId, f);
  const [rows, total] = await Promise.all([
    MatchResult.find(where)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    MatchResult.countDocuments(where),
  ]);
  const projectIds = rows.map((m) => m.projectId);
  const projects = projectIds.length
    ? await Project.find({ _id: { $in: projectIds } }, { name: 1, category: 1, quantity: 1, deadline: 1, status: 1, currency: 1, brandId: 1 }).lean()
    : [];
  const [brandProfiles, quotations] = projects.length
    ? await Promise.all([
        BrandProfile.find({ userId: { $in: projects.map((p) => p.brandId) } }, { userId: 1, companyName: 1, country: 1 }).lean(),
        Quotation.find({ projectId: { $in: projectIds }, manufacturerId }, { projectId: 1, status: 1, totalAmount: 1, version: 1 }).lean(),
      ])
    : [[], []];
  const projectById = byId(projects);
  const brandByUser = byId(brandProfiles, "userId");
  const quotesByProject = groupBy(quotations, "projectId");
  const items = rows.map((m) => {
    const p = projectById.get(String(m.projectId));
    const bp = p ? brandByUser.get(String(p.brandId)) : null;
    return {
      ...serialize(MatchResult, m),
      project: p
        ? {
            id: p._id.toHexString(),
            name: p.name,
            category: p.category,
            quantity: p.quantity ?? null,
            deadline: p.deadline ?? null,
            status: p.status,
            currency: p.currency,
            brand: { brandProfile: bp ? { companyName: bp.companyName, country: bp.country } : null },
            quotations: (quotesByProject.get(String(p._id)) ?? []).map((q) => {
              const sq = serialize(Quotation, q);
              return { status: sq.status, totalAmount: sq.totalAmount, version: sq.version };
            }),
          }
        : null,
    };
  });
  return { items, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

/** Everything a matched factory needs to quote. Unmatched factories get "not found". */
export async function getOpportunity(actor, projectId) {
  assertRole(actor, "MANUFACTURER");
  const manufacturerId = oid(actor.id);
  const pid = oid(projectId);
  const match = await MatchResult.findOne({ projectId: pid, manufacturerId }).lean();
  if (!match) throw notFound("Opportunity");
  await expireQuotations({ projectId: pid.toHexString(), manufacturerId: actor.id });
  const project = await Project.findById(pid).orFail().lean();
  const [brandProfile, attachments, order, revisions, quotation, profile] = await Promise.all([
    BrandProfile.findOne({ userId: project.brandId }, { companyName: 1, country: 1, description: 1 }).lean(),
    ProjectAttachment.find({ projectId: pid }).lean(),
    Order.findOne({ projectId: pid }, { manufacturerId: 1 }).lean(),
    ProjectRevision.find({ projectId: pid }).sort({ createdAt: -1, _id: -1 }).limit(10).lean(),
    Quotation.findOne({ projectId: pid, manufacturerId }).lean(),
    ManufacturerProfile.findOne({ userId: manufacturerId }, { verificationStatus: 1, typicalLeadTimeDays: 1, minOrderQuantity: 1 }).lean(),
  ]);
  const quotationRevisions = quotation ? await QuotationRevision.find({ quotationId: quotation._id }).sort({ version: -1 }).lean() : [];
  return {
    match: serialize(MatchResult, match),
    project: {
      ...serialize(Project, project),
      brand: { brandProfile: brandProfile ? { companyName: brandProfile.companyName, country: brandProfile.country, description: brandProfile.description ?? null } : null },
      attachments: serialize(ProjectAttachment, sortAttachments(attachments, { createdAt: false })),
      order: order ? { id: order._id.toHexString(), manufacturerId: order.manufacturerId.toHexString() } : null,
      revisions: serialize(ProjectRevision, revisions),
    },
    quotation: quotation ? { ...serialize(Quotation, quotation), revisions: serialize(QuotationRevision, quotationRevisions) } : null,
    profile: profile ? { verificationStatus: profile.verificationStatus, typicalLeadTimeDays: profile.typicalLeadTimeDays, minOrderQuantity: profile.minOrderQuantity } : null,
  };
}

/**
 * The factory's quotations, most recently changed first.
 * @param {{ status?: string, page?: number }} [f]
 */
export async function listMyQuotations(actor, f = {}) {
  assertRole(actor, "MANUFACTURER");
  await expireQuotations({ manufacturerId: actor.id });
  const pageSize = 10;
  const page = Math.max(1, f.page ?? 1);
  const where = { manufacturerId: oid(actor.id), ...(f.status ? { status: f.status } : {}) };
  const [rows, total] = await Promise.all([
    Quotation.find(where)
      .sort({ updatedAt: -1, _id: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    Quotation.countDocuments(where),
  ]);
  const projectIds = rows.map((q) => q.projectId);
  const [projects, orders] = projectIds.length
    ? await Promise.all([
        Project.find({ _id: { $in: projectIds } }, { name: 1, category: 1 }).lean(),
        Order.find({ projectId: { $in: projectIds } }, { projectId: 1, manufacturerId: 1 }).lean(),
      ])
    : [[], []];
  const projectById = byId(projects);
  const orderByProject = byId(orders, "projectId");
  const items = rows.map((q) => {
    const p = projectById.get(String(q.projectId));
    const o = orderByProject.get(String(q.projectId));
    return {
      ...serialize(Quotation, q),
      project: p
        ? { id: p._id.toHexString(), name: p.name, category: p.category, order: o ? { id: o._id.toHexString(), manufacturerId: o.manufacturerId.toHexString() } : null }
        : null,
    };
  });
  return { items, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
}
