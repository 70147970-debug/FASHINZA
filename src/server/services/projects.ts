import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { AttachmentKind, ProjectStatus } from "@/generated/prisma/enums";
import { projectDraftSchema, projectSubmitSchema, type ProjectDraftInput } from "@/lib/validation/project";
import { zodFieldErrors } from "@/lib/form-state";
import type { Actor } from "@/server/actor";
import { assertRole, projectScope } from "@/server/access";
import { AppError, conflict, invalid, notFound } from "@/server/errors";
import { logActivity, notify } from "@/server/events";
import { deleteStoredFile, saveUpload } from "@/server/storage";
import { runMatchingForProject } from "./matching";

const EDITABLE_AFTER_SUBMIT: ProjectStatus[] = ["SUBMITTED", "QUOTING"];
const COMPARED_FIELDS = [
  "name", "category", "description", "quantity", "maxMoq", "targetUnitPrice", "currency", "deadline", "fabricRequirements", "fabrics", "sizes", "colors",
  "additionalInstructions", "requiredCapabilities", "preferredCountry", "requiredCertifications", "sustainabilityNotes",
] as const;

/** Optional fields that were cleared must be written as null, not skipped. */
function toData(input: Partial<ProjectDraftInput>) {
  return Object.fromEntries(Object.entries(input).map(([k, v]) => [k, v === undefined ? null : v])) as Partial<ProjectDraftInput>;
}

/** Database rows use null and Decimal; the validation schemas expect undefined and strings. */
function forValidation(row: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(row).map(([k, v]) => [k, v === null ? undefined : k === "targetUnitPrice" ? String(v) : v]),
  );
}

async function ownedProject(actor: Actor, projectId: string) {
  assertRole(actor, "BRAND");
  const project = await db.project.findFirst({ where: { id: projectId, brandId: actor.id } });
  if (!project) throw notFound("Project");
  return project;
}

/**
 * Creates or updates a project from wizard step data. Drafts can be saved with partial data;
 * submitted projects can still be edited until a quotation is accepted, and every such change
 * is stored as a ProjectRevision and announced to factories that are quoting.
 */
export async function saveProject(actor: Actor, projectId: string | null, raw: Record<string, unknown>, step: number) {
  assertRole(actor, "BRAND");
  const parsed = projectDraftSchema.partial({ name: true, category: true }).safeParse(raw);
  if (!parsed.success) throw new AppError("Please correct the highlighted fields.", "INVALID", zodFieldErrors(parsed.error));
  // Only the fields sent by this wizard step are written; defaults must not overwrite other steps.
  const input = Object.fromEntries(Object.entries(parsed.data).filter(([k]) => k in raw)) as Partial<ProjectDraftInput>;

  if (!projectId) {
    const full = projectDraftSchema.pick({ name: true, category: true }).safeParse(raw);
    if (!full.success) throw new AppError("Please correct the highlighted fields.", "INVALID", zodFieldErrors(full.error));
    const created = await db.$transaction(async (tx) => {
      const p = await tx.project.create({ data: { ...toData(input), name: full.data.name, category: full.data.category, brandId: actor.id, wizardStep: step + 1 } });
      await logActivity(tx, { actorId: actor.id, projectId: p.id, type: "PROJECT_CREATED", message: "Draft project created." });
      return p;
    });
    return created.id;
  }

  const project = await ownedProject(actor, projectId);
  if (project.status === "DRAFT") {
    await db.project.update({ where: { id: project.id }, data: { ...toData(input), wizardStep: Math.max(project.wizardStep, step + 1) } });
    return project.id;
  }
  if (!EDITABLE_AFTER_SUBMIT.includes(project.status)) throw conflict("This project can no longer be edited because production has started.");

  // Submitted project: the merged result must still be complete.
  const check = projectSubmitSchema.safeParse(forValidation({ ...project, ...toData(input) }));
  if (!check.success) throw new AppError("Please correct the highlighted fields.", "INVALID", zodFieldErrors(check.error));

  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of COMPARED_FIELDS) {
    if (!(key in input)) continue;
    const before = project[key as keyof typeof project];
    const after = (input as Record<string, unknown>)[key];
    const norm = (v: unknown) => (v instanceof Date ? v.toISOString() : v === null || v === undefined ? null : typeof v === "object" ? JSON.stringify(v) : String(v));
    if (norm(before) !== norm(after ?? null)) changes[key] = { from: norm(before), to: norm(after ?? null) };
  }
  if (!Object.keys(changes).length) return project.id;

  await db.$transaction(async (tx) => {
    await tx.project.update({ where: { id: project.id }, data: toData(input) });
    await tx.projectRevision.create({ data: { projectId: project.id, changedById: actor.id, changes: changes as Prisma.InputJsonValue } });
    await logActivity(tx, { actorId: actor.id, projectId: project.id, type: "PROJECT_REVISED", message: `Project requirements updated: ${Object.keys(changes).join(", ")}.` });
    const quoting = await tx.quotation.findMany({ where: { projectId: project.id, status: { in: ["DRAFT", "SUBMITTED", "REVISION_REQUESTED"] } }, select: { manufacturerId: true } });
    if (quoting.length) {
      await notify(tx, quoting.map((q) => q.manufacturerId), "SYSTEM", "Project requirements changed", `The brand updated “${project.name}”. Review the changes before finalising your quotation.`, `/opportunities/${project.id}`);
    }
  });
  return project.id;
}

/** Validates the complete project, then runs factory matching. */
export async function submitProject(actor: Actor, projectId: string) {
  const project = await ownedProject(actor, projectId);
  if (project.status !== "DRAFT") throw conflict("This project has already been submitted.");
  const check = projectSubmitSchema.safeParse(forValidation(project));
  if (!check.success) throw new AppError("Some required details are missing. Complete the highlighted steps before submitting.", "INVALID", zodFieldErrors(check.error));
  const techPacks = await db.projectAttachment.count({ where: { projectId, kind: "TECH_PACK" } });
  if (!techPacks) throw invalid("Upload a tech pack before submitting so factories can quote accurately.", { techPack: "Upload at least one tech pack." });

  return db.$transaction(async (tx) => {
    // Re-check inside the transaction so a double submit cannot run matching twice.
    const updated = await tx.project.updateMany({ where: { id: projectId, status: "DRAFT" }, data: { status: "SUBMITTED", submittedAt: new Date(), wizardStep: 6 } });
    if (!updated.count) throw conflict("This project has already been submitted.");
    await logActivity(tx, { actorId: actor.id, projectId, type: "PROJECT_SUBMITTED", message: "Project submitted for matching." });
    const summary = await runMatchingForProject(tx, projectId, actor.id);
    if (summary.eligible > 0) await tx.project.update({ where: { id: projectId }, data: { status: "QUOTING" } });
    await notify(
      tx,
      actor.id,
      "PROJECT_SUBMITTED",
      "Project submitted",
      summary.eligible ? `${summary.eligible} verified ${summary.eligible === 1 ? "factory matches" : "factories match"} “${project.name}” and ${summary.eligible === 1 ? "has" : "have"} been invited to quote.` : `No verified factory currently meets every requirement for “${project.name}”. Review the matching summary.`,
      `/projects/${projectId}`,
    );
    return summary;
  }, { timeout: 20_000 });
}

export async function rerunMatching(actor: Actor, projectId: string) {
  const project = await ownedProject(actor, projectId);
  if (!EDITABLE_AFTER_SUBMIT.includes(project.status)) throw conflict("Matching can only be run before a quotation is accepted.");
  return db.$transaction(async (tx) => {
    const summary = await runMatchingForProject(tx, projectId, actor.id);
    if (summary.eligible > 0 && project.status === "SUBMITTED") await tx.project.update({ where: { id: projectId }, data: { status: "QUOTING" } });
    return summary;
  }, { timeout: 20_000 });
}

export async function cancelProject(actor: Actor, projectId: string, reason: string) {
  const project = await ownedProject(actor, projectId);
  if (!["DRAFT", ...EDITABLE_AFTER_SUBMIT].includes(project.status)) throw conflict("Projects with an accepted quotation cannot be cancelled here. Raise a dispute instead.");
  await db.$transaction(async (tx) => {
    await tx.project.update({ where: { id: projectId }, data: { status: "CANCELLED" } });
    const open = await tx.quotation.findMany({ where: { projectId, status: { in: ["DRAFT", "SUBMITTED", "REVISION_REQUESTED"] } }, select: { id: true, manufacturerId: true } });
    await tx.quotation.updateMany({ where: { id: { in: open.map((q) => q.id) } }, data: { status: "REJECTED", decidedAt: new Date() } });
    if (open.length) await notify(tx, open.map((q) => q.manufacturerId), "QUOTATION_REJECTED", "Project cancelled", `The brand cancelled “${project.name}”.`, `/opportunities/${projectId}`);
    await logActivity(tx, { actorId: actor.id, projectId, type: "PROJECT_CANCELLED", message: `Project cancelled: ${reason}` });
  });
}

/** Drafts that were never submitted can be removed completely, including their files. */
export async function deleteDraft(actor: Actor, projectId: string) {
  const project = await ownedProject(actor, projectId);
  if (project.status !== "DRAFT") throw conflict("Only drafts can be deleted. Cancel submitted projects instead.");
  const files = await db.projectAttachment.findMany({ where: { projectId }, select: { fileKey: true } });
  await db.project.delete({ where: { id: projectId } });
  await Promise.all(files.map((f) => deleteStoredFile(f.fileKey)));
}

/** Uploads a file. Tech packs receive the next version number; earlier versions are kept as history. */
export async function addAttachment(actor: Actor, projectId: string, file: File, kind: AttachmentKind, notes?: string) {
  const project = await ownedProject(actor, projectId);
  if (["CANCELLED", "DELIVERED"].includes(project.status)) throw conflict("Files cannot be added to a closed project.");
  const stored = await saveUpload(file, "projects", { imagesOnly: kind === "SKETCH" });
  try {
    for (let attempt = 0; ; attempt++) {
      try {
        return await db.$transaction(async (tx) => {
          let version: number | null = null;
          if (kind === "TECH_PACK") {
            const latest = await tx.projectAttachment.aggregate({ where: { projectId, kind: "TECH_PACK" }, _max: { version: true } });
            version = (latest._max.version ?? 0) + 1;
          }
          const att = await tx.projectAttachment.create({ data: { projectId, uploadedById: actor.id, kind, version, notes, ...stored } });
          if (kind === "TECH_PACK") {
            await logActivity(tx, { actorId: actor.id, projectId, type: "TECH_PACK_VERSION", message: `Tech pack version ${version} uploaded${notes ? `: ${notes}` : ""}.` });
            if (project.status !== "DRAFT") {
              const order = await tx.order.findUnique({ where: { projectId }, select: { manufacturerId: true, id: true } });
              const recipients = order ? [order.manufacturerId] : (await tx.matchResult.findMany({ where: { projectId }, select: { manufacturerId: true } })).map((m) => m.manufacturerId);
              if (recipients.length) await notify(tx, recipients, "SYSTEM", "New tech pack version", `Version ${version} of the tech pack for “${project.name}” is now the current version.`, order ? `/orders/${order.id}` : `/opportunities/${projectId}`);
            }
          }
          return att;
        });
      } catch (e) {
        // Two uploads raced for the same version number; retry once with the next number.
        if ((e as { code?: string }).code === "P2002" && attempt < 2) continue;
        throw e;
      }
    }
  } catch (e) {
    await deleteStoredFile(stored.fileKey);
    throw e;
  }
}

/** Only files on drafts can be deleted; tech pack history is preserved after submission. */
export async function deleteAttachment(actor: Actor, attachmentId: string) {
  assertRole(actor, "BRAND");
  const att = await db.projectAttachment.findFirst({ where: { id: attachmentId, project: { brandId: actor.id } }, include: { project: { select: { status: true } } } });
  if (!att) throw notFound("File");
  if (att.project.status !== "DRAFT") throw conflict("Files on a submitted project are kept as part of its history. Upload a new version instead.");
  await db.projectAttachment.delete({ where: { id: att.id } });
  await deleteStoredFile(att.fileKey);
}

export async function getProject(actor: Actor, projectId: string) {
  const project = await db.project.findFirst({
    where: { id: projectId, ...projectScope(actor) },
    include: {
      brand: { select: { name: true, brandProfile: { select: { companyName: true, country: true } } } },
      attachments: { orderBy: [{ kind: "asc" }, { version: "desc" }, { createdAt: "desc" }] },
      order: { select: { id: true, reference: true, status: true, manufacturerId: true } },
      revisions: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  if (!project) throw notFound("Project");
  return project;
}

export type ProjectListFilters = { q?: string; status?: ProjectStatus | "ACTIVE"; page?: number; pageSize?: number };

export async function listProjects(actor: Actor, f: ProjectListFilters = {}) {
  const pageSize = Math.min(f.pageSize ?? 10, 50);
  const page = Math.max(1, f.page ?? 1);
  const where: Prisma.ProjectWhereInput = {
    AND: [
      projectScope(actor),
      f.q ? { name: { contains: f.q, mode: "insensitive" } } : {},
      f.status === "ACTIVE" ? { status: { notIn: ["DELIVERED", "CANCELLED"] } } : f.status ? { status: f.status } : {},
    ],
  };
  const [items, total] = await Promise.all([
    db.project.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { _count: { select: { quotations: { where: { status: { in: ["SUBMITTED", "REVISION_REQUESTED"] } } }, matchResults: true } }, order: { select: { id: true } } },
    }),
    db.project.count({ where }),
  ]);
  return { items, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
}
