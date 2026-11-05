/**
 * Projects (port of src/server/services/projects.ts): wizard drafts, submission, matching runs, cancellation,
 * attachments, and the project read models used by the project pages.
 */
import { attachmentKind } from "@fashinza/shared/constants.js";
import { zodFieldErrors } from "@fashinza/shared/form-state.js";
import { fieldLabel } from "@fashinza/shared/labels.js";
import { projectDraftSchema, projectSubmitSchema, REVIEW_STEP } from "@fashinza/shared/validation/project.js";
import { isDuplicateKeyError, withTransaction } from "../db.js";
import { assertRole, projectFilter } from "../lib/access.js";
import { AppError, conflict, invalid, notFound } from "../lib/errors.js";
import { logActivity, notify } from "../lib/events.js";
import { and, byId, d128, decimalString, oid, opts, s, sortAttachments } from "../lib/records.js";
import { containsInsensitive, serialize } from "../lib/serialize.js";
import { deleteStoredFile, saveUpload } from "../lib/storage.js";
import { ActivityLog } from "../models/ActivityLog.js";
import { BrandProfile } from "../models/BrandProfile.js";
import { IssueReport } from "../models/IssueReport.js";
import { MatchResult } from "../models/MatchResult.js";
import { Order } from "../models/Order.js";
import { Project } from "../models/Project.js";
import { ProjectAttachment } from "../models/ProjectAttachment.js";
import { ProjectRevision } from "../models/ProjectRevision.js";
import { Quotation } from "../models/Quotation.js";
import { QuotationRevision } from "../models/QuotationRevision.js";
import { User } from "../models/User.js";
import { runMatchingForProject } from "./matching.js";

const EDITABLE_AFTER_SUBMIT = ["SUBMITTED", "QUOTING"];
const OPEN_QUOTE = ["DRAFT", "SUBMITTED", "REVISION_REQUESTED"];
export const COMPARED_FIELDS = [
  "name", "category", "description", "quantity", "maxMoq", "targetUnitPrice", "currency", "deadline", "fabricRequirements", "fabrics", "sizes", "colors",
  "additionalInstructions", "requiredCapabilities", "preferredCountry", "requiredCertifications", "sustainabilityNotes",
  "sampleRequired", "sampleQuantity", "sampleSizes", "sampleNotes",
];

const INVALID_FIELDS = "Please correct the highlighted fields.";

/** Optional fields that were cleared must be written as null, not skipped. The target price is Decimal(12,2). */
function toData(input) {
  return Object.fromEntries(Object.entries(input).map(([k, v]) => [k, v === undefined ? null : k === "targetUnitPrice" ? d128(v, 2) : v]));
}

/** Database rows use null and Decimal; the validation schemas expect undefined and strings. */
export function forValidation(row) {
  return Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v === null ? undefined : k === "targetUnitPrice" ? String(v) : v]));
}

/**
 * A field value as stored in ProjectRevision.changes (same strings as the PostgreSQL app: ISO dates, JSON arrays,
 * Prisma Decimal.toString() for the target price, numbers and booleans as text).
 */
export function normaliseRevisionValue(v) {
  if (v instanceof Date) return v.toISOString();
  if (v === null || v === undefined) return null;
  if (v?._bsontype === "Decimal128") return decimalString(v);
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/** The `{ field: { from, to } }` changes between a stored project and the step input (only keys in the input). */
export function projectChanges(project, input) {
  /** @type {Record<string, { from: string | null, to: string | null }>} */
  const changes = {};
  for (const key of COMPARED_FIELDS) {
    if (!(key in input)) continue;
    const before = normaliseRevisionValue(project[key]);
    const after = normaliseRevisionValue(input[key] ?? null);
    if (before !== after) changes[key] = { from: before, to: after };
  }
  return changes;
}

/**
 * What still blocks submission (the edit page's review step): projectSubmitSchema issues plus a missing tech pack.
 * @param {Record<string, unknown>} project lean project document (Dates and Decimal128 as stored)
 * @param {{ kind: string }[]} attachments
 */
export function submitIssuesFor(project, attachments) {
  const check = projectSubmitSchema.safeParse(forValidation(project));
  const issues = check.success ? [] : check.error.issues.map((i) => ({ field: String(i.path[0]), message: i.message }));
  if (!attachments.some((a) => a.kind === "TECH_PACK")) issues.push({ field: "techPack", message: "Upload at least one tech pack." });
  return issues;
}

async function ownedProject(actor, projectId, session) {
  assertRole(actor, "BRAND");
  const project = await Project.findOne({ _id: oid(projectId), brandId: oid(actor.id) }).session(s(session)).lean();
  if (!project) throw notFound("Project");
  return project;
}

/**
 * Creates or updates a project from wizard step data. Drafts can be saved with partial data;
 * submitted projects can still be edited until a quotation is accepted, and every such change
 * is stored as a ProjectRevision and announced to factories that are quoting.
 * @returns {Promise<string>} the project id
 */
export async function saveProject(actor, projectId, raw, step) {
  assertRole(actor, "BRAND");
  const parsed = projectDraftSchema.partial({ name: true, category: true }).safeParse(raw);
  if (!parsed.success) throw new AppError(INVALID_FIELDS, "INVALID", zodFieldErrors(parsed.error));
  // Only the fields sent by this wizard step are written; defaults must not overwrite other steps.
  const input = Object.fromEntries(Object.entries(parsed.data).filter(([k]) => k in raw));

  if (!projectId) {
    const full = projectDraftSchema.pick({ name: true, category: true }).safeParse(raw);
    if (!full.success) throw new AppError(INVALID_FIELDS, "INVALID", zodFieldErrors(full.error));
    return withTransaction(async (session) => {
      const [p] = await Project.create(
        [{ ...toData(input), name: full.data.name, category: full.data.category, brandId: oid(actor.id), wizardStep: step + 1 }],
        opts(session),
      );
      const id = p._id.toHexString();
      await logActivity(session, { actorId: actor.id, projectId: id, type: "PROJECT_CREATED", message: "Draft project created." });
      return id;
    });
  }

  const project = await ownedProject(actor, projectId);
  const id = project._id.toHexString();
  if (project.status === "DRAFT") {
    await Project.updateOne({ _id: project._id }, { $set: { ...toData(input), wizardStep: Math.max(project.wizardStep, step + 1) } });
    return id;
  }
  if (!EDITABLE_AFTER_SUBMIT.includes(project.status)) throw conflict("This project can no longer be edited because production has started.");

  // Submitted project: the merged result must still be complete.
  const check = projectSubmitSchema.safeParse(forValidation({ ...project, ...toData(input) }));
  if (!check.success) throw new AppError(INVALID_FIELDS, "INVALID", zodFieldErrors(check.error));

  const changes = projectChanges(project, input);
  if (!Object.keys(changes).length) return id;

  await withTransaction(async (session) => {
    await Project.updateOne({ _id: project._id }, { $set: toData(input) }, opts(session));
    await ProjectRevision.create([{ projectId: project._id, changedById: oid(actor.id), changes }], opts(session));
    await logActivity(session, {
      actorId: actor.id,
      projectId: id,
      type: "PROJECT_REVISED",
      message: `Project requirements updated: ${Object.keys(changes).map(fieldLabel).join(", ")}.`,
    });
    const quoting = await Quotation.find({ projectId: project._id, status: { $in: OPEN_QUOTE } }, { manufacturerId: 1 }).session(s(session)).lean();
    if (quoting.length) {
      await notify(
        session,
        quoting.map((q) => q.manufacturerId.toHexString()),
        "SYSTEM",
        "Project requirements changed",
        `The brand updated “${project.name}”. Review the changes before finalising your quotation.`,
        `/opportunities/${id}`,
      );
    }
  });
  return id;
}

/** Validates the complete project, then runs factory matching. */
export async function submitProject(actor, projectId) {
  const project = await ownedProject(actor, projectId);
  if (project.status !== "DRAFT") throw conflict("This project has already been submitted.");
  const check = projectSubmitSchema.safeParse(forValidation(project));
  if (!check.success) throw new AppError("Some required details are missing. Complete the highlighted steps before submitting.", "INVALID", zodFieldErrors(check.error));
  const techPacks = await ProjectAttachment.countDocuments({ projectId: project._id, kind: "TECH_PACK" });
  if (!techPacks) throw invalid("Upload a tech pack before submitting so factories can quote accurately.", { techPack: "Upload at least one tech pack." });
  const id = project._id.toHexString();

  return withTransaction(async (session) => {
    // Re-check inside the transaction so a double submit cannot run matching twice.
    const updated = await Project.updateOne(
      { _id: project._id, status: "DRAFT" },
      { $set: { status: "SUBMITTED", submittedAt: new Date(), wizardStep: REVIEW_STEP } },
      opts(session),
    );
    if (!updated.modifiedCount) throw conflict("This project has already been submitted.");
    await logActivity(session, { actorId: actor.id, projectId: id, type: "PROJECT_SUBMITTED", message: "Project submitted for matching." });
    const summary = await runMatchingForProject(session, id, actor.id);
    if (summary.eligible > 0) await Project.updateOne({ _id: project._id }, { $set: { status: "QUOTING" } }, opts(session));
    await notify(
      session,
      actor.id,
      "PROJECT_SUBMITTED",
      "Project submitted",
      summary.eligible
        ? `${summary.eligible} verified ${summary.eligible === 1 ? "factory matches" : "factories match"} “${project.name}” and ${summary.eligible === 1 ? "has" : "have"} been invited to quote.`
        : `No verified factory currently meets every requirement for “${project.name}”. Review the matching summary.`,
      `/projects/${id}`,
    );
    return summary;
  });
}

export async function rerunMatching(actor, projectId) {
  const project = await ownedProject(actor, projectId);
  if (!EDITABLE_AFTER_SUBMIT.includes(project.status)) throw conflict("Matching can only be run before a quotation is accepted.");
  return withTransaction(async (session) => {
    const summary = await runMatchingForProject(session, project._id.toHexString(), actor.id);
    if (summary.eligible > 0 && project.status === "SUBMITTED") await Project.updateOne({ _id: project._id }, { $set: { status: "QUOTING" } }, opts(session));
    return summary;
  });
}

export async function cancelProject(actor, projectId, reason) {
  const project = await ownedProject(actor, projectId);
  if (!["DRAFT", ...EDITABLE_AFTER_SUBMIT].includes(project.status)) throw conflict("Projects with an accepted quotation cannot be cancelled here. Raise a dispute instead.");
  const id = project._id.toHexString();
  await withTransaction(async (session) => {
    await Project.updateOne({ _id: project._id }, { $set: { status: "CANCELLED" } }, opts(session));
    const open = await Quotation.find({ projectId: project._id, status: { $in: OPEN_QUOTE } }, { _id: 1, manufacturerId: 1 }).session(s(session)).lean();
    await Quotation.updateMany({ _id: { $in: open.map((q) => q._id) } }, { $set: { status: "REJECTED", decidedAt: new Date() } }, opts(session));
    if (open.length) {
      await notify(session, open.map((q) => q.manufacturerId.toHexString()), "QUOTATION_REJECTED", "Project cancelled", `The brand cancelled “${project.name}”.`, `/opportunities/${id}`);
    }
    await logActivity(session, { actorId: actor.id, projectId: id, type: "PROJECT_CANCELLED", message: `Project cancelled: ${reason}` });
  });
}

/**
 * Drafts that were never submitted can be removed completely, including their files. Reproduces the Prisma
 * cascades: attachments, revisions, quotations (and their revisions), match results and activity logs go; issue
 * reports keep the dispute with projectId null.
 */
export async function deleteDraft(actor, projectId) {
  const project = await ownedProject(actor, projectId);
  if (project.status !== "DRAFT") throw conflict("Only drafts can be deleted. Cancel submitted projects instead.");
  const files = await ProjectAttachment.find({ projectId: project._id }, { fileKey: 1 }).lean();
  await withTransaction(async (session) => {
    const quotationIds = (await Quotation.find({ projectId: project._id }, { _id: 1 }).session(s(session)).lean()).map((q) => q._id);
    if (quotationIds.length) await QuotationRevision.deleteMany({ quotationId: { $in: quotationIds } }, opts(session));
    await Quotation.deleteMany({ projectId: project._id }, opts(session));
    await ProjectAttachment.deleteMany({ projectId: project._id }, opts(session));
    await ProjectRevision.deleteMany({ projectId: project._id }, opts(session));
    await MatchResult.deleteMany({ projectId: project._id }, opts(session));
    await ActivityLog.deleteMany({ projectId: project._id }, opts(session));
    await IssueReport.updateMany({ projectId: project._id }, { $set: { projectId: null } }, opts(session));
    await Project.deleteOne({ _id: project._id }, opts(session));
  });
  await Promise.all(files.map((f) => deleteStoredFile(f.fileKey)));
}

/**
 * Uploads a file. Tech packs receive the next version number; earlier versions are kept as history.
 * Reference images and sketches must be images; measurement charts and other files may also be PDFs.
 * @param {{ originalname: string, mimetype: string, size: number, buffer: Buffer }} file multer-like file
 */
export async function addAttachment(actor, projectId, file, kind, notes) {
  const project = await ownedProject(actor, projectId);
  if (["CANCELLED", "DELIVERED"].includes(project.status)) throw conflict("Files cannot be added to a closed project.");
  const stored = await saveUpload(file, "projects", { imagesOnly: attachmentKind(kind).imagesOnly });
  const id = project._id.toHexString();
  const note = notes ?? null;
  try {
    for (let attempt = 0; ; attempt++) {
      try {
        return await withTransaction(async (session) => {
          let version = null;
          if (kind === "TECH_PACK") {
            const latest = await ProjectAttachment.findOne({ projectId: project._id, kind: "TECH_PACK", version: { $type: "number" } }, { version: 1 })
              .sort({ version: -1 })
              .session(s(session))
              .lean();
            version = (latest?.version ?? 0) + 1;
          }
          const [att] = await ProjectAttachment.create([{ projectId: project._id, uploadedById: oid(actor.id), kind, version, notes: note, ...stored }], opts(session));
          if (kind === "TECH_PACK") {
            await logActivity(session, { actorId: actor.id, projectId: id, type: "TECH_PACK_VERSION", message: `Tech pack version ${version} uploaded${notes ? `: ${notes}` : ""}.` });
            if (project.status !== "DRAFT") {
              const order = await Order.findOne({ projectId: project._id }, { manufacturerId: 1 }).session(s(session)).lean();
              const recipients = order
                ? [order.manufacturerId.toHexString()]
                : (await MatchResult.find({ projectId: project._id }, { manufacturerId: 1 }).session(s(session)).lean()).map((m) => m.manufacturerId.toHexString());
              if (recipients.length) {
                await notify(
                  session,
                  recipients,
                  "SYSTEM",
                  "New tech pack version",
                  `Version ${version} of the tech pack for “${project.name}” is now the current version.`,
                  order ? `/orders/${order._id.toHexString()}` : `/opportunities/${id}`,
                );
              }
            }
          } else if (project.status !== "DRAFT") {
            // Drafts are private; once factories can see the project, record what was added and when.
            await logActivity(session, {
              actorId: actor.id,
              projectId: id,
              type: "FILE_ADDED",
              message: `${attachmentKind(kind).label} added: ${att.fileName}${notes ? ` (${notes})` : ""}.`,
            });
          }
          return serialize(ProjectAttachment, att);
        });
      } catch (e) {
        // Two uploads raced for the same version number; retry once with the next number.
        if (isDuplicateKeyError(e) && attempt < 2) continue;
        throw e;
      }
    }
  } catch (e) {
    await deleteStoredFile(stored.fileKey);
    throw e;
  }
}

/** Only files on drafts can be deleted; tech pack history is preserved after submission. */
export async function deleteAttachment(actor, attachmentId) {
  assertRole(actor, "BRAND");
  const att = await ProjectAttachment.findOne({ _id: oid(attachmentId) }).lean();
  const project = att ? await Project.findOne({ _id: att.projectId, brandId: oid(actor.id) }, { status: 1 }).lean() : null;
  if (!att || !project) throw notFound("File");
  if (project.status !== "DRAFT") throw conflict("Files on a submitted project are kept as part of its history. Upload a new version instead.");
  await ProjectAttachment.deleteOne({ _id: att._id });
  await deleteStoredFile(att.fileKey);
}

/** The scoped project document (lean) or NOT_FOUND "Project". */
async function scopedProject(actor, projectId) {
  const project = await Project.findOne(and({ _id: oid(projectId) }, await projectFilter(actor))).lean();
  if (!project) throw notFound("Project");
  return project;
}

/**
 * getProject tree: Project* + brand { name, brandProfile { companyName, country } | null }, attachments,
 * order { id, reference, status, manufacturerId } | null, revisions (newest first, 20).
 * Pass `{ withLean: true }` to also receive the raw document (for submit checks).
 */
export async function getProject(actor, projectId, { withLean = false } = {}) {
  const project = await scopedProject(actor, projectId);
  const [brand, brandProfile, attachments, order, revisions] = await Promise.all([
    User.findById(project.brandId, { name: 1 }).lean(),
    BrandProfile.findOne({ userId: project.brandId }, { companyName: 1, country: 1 }).lean(),
    ProjectAttachment.find({ projectId: project._id }).lean(),
    Order.findOne({ projectId: project._id }, { reference: 1, status: 1, manufacturerId: 1 }).lean(),
    ProjectRevision.find({ projectId: project._id }).sort({ createdAt: -1, _id: -1 }).limit(20).lean(),
  ]);
  const sorted = sortAttachments(attachments);
  const tree = {
    ...serialize(Project, project),
    brand: brand ? { name: brand.name, brandProfile: brandProfile ? { companyName: brandProfile.companyName, country: brandProfile.country } : null } : null,
    attachments: serialize(ProjectAttachment, sorted),
    order: order ? { id: order._id.toHexString(), reference: order.reference, status: order.status, manufacturerId: order.manufacturerId.toHexString() } : null,
    revisions: serialize(ProjectRevision, revisions),
  };
  return withLean ? { tree, lean: project, attachments: sorted } : tree;
}

/** GET /api/projects/:id — the wizard's project plus the review step's submit checklist. */
export async function getProjectForEdit(actor, projectId) {
  assertRole(actor, "BRAND");
  const { tree, lean, attachments } = await getProject(actor, projectId, { withLean: true });
  return { project: tree, submitIssues: submitIssuesFor(lean, attachments) };
}

/** Project timeline entries (not order entries), newest first, with the actor's name. */
export async function listProjectActivities(projectId, take = 30) {
  const rows = await ActivityLog.find({ projectId: oid(projectId), orderId: null }).sort({ createdAt: -1, _id: -1 }).limit(take).lean();
  const actorIds = [...new Set(rows.map((r) => r.actorId).filter(Boolean).map(String))];
  const actors = actorIds.length ? byId(await User.find({ _id: { $in: actorIds.map(oid) } }, { name: 1 }).lean()) : new Map();
  return rows.map((r) => {
    const a = r.actorId ? actors.get(String(r.actorId)) : null;
    return { ...serialize(ActivityLog, r), actor: a ? { name: a.name } : null };
  });
}

/**
 * @param {{ id: string, role: string }} actor
 * @param {{ q?: string, status?: string, page?: number, pageSize?: number }} [f]
 */
export async function listProjects(actor, f = {}) {
  const pageSize = Math.min(f.pageSize ?? 10, 50);
  const page = Math.max(1, f.page ?? 1);
  const where = and(
    await projectFilter(actor),
    f.q ? { name: containsInsensitive(f.q) } : {},
    f.status === "ACTIVE" ? { status: { $nin: ["DELIVERED", "CANCELLED"] } } : f.status ? { status: f.status } : {},
  );
  const [rows, total] = await Promise.all([
    Project.find(where)
      .sort({ updatedAt: -1, _id: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    Project.countDocuments(where),
  ]);
  const ids = rows.map((p) => p._id);
  const [quoteCounts, matchCounts, orders] = ids.length
    ? await Promise.all([
        Quotation.aggregate([{ $match: { projectId: { $in: ids }, status: { $in: ["SUBMITTED", "REVISION_REQUESTED"] } } }, { $group: { _id: "$projectId", n: { $sum: 1 } } }]),
        MatchResult.aggregate([{ $match: { projectId: { $in: ids } } }, { $group: { _id: "$projectId", n: { $sum: 1 } } }]),
        Order.find({ projectId: { $in: ids } }, { projectId: 1, deliveredAt: 1 }).lean(),
      ])
    : [[], [], []];
  const quotes = new Map(quoteCounts.map((c) => [String(c._id), c.n]));
  const matches = new Map(matchCounts.map((c) => [String(c._id), c.n]));
  const orderByProject = byId(orders, "projectId");
  const items = rows.map((p) => {
    const order = orderByProject.get(String(p._id));
    return {
      ...serialize(Project, p),
      _count: { quotations: quotes.get(String(p._id)) ?? 0, matchResults: matches.get(String(p._id)) ?? 0 },
      order: order ? { id: order._id.toHexString(), deliveredAt: order.deliveredAt ?? null } : null,
    };
  });
  return { items, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
}
