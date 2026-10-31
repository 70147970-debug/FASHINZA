import { db } from "@/lib/db";
import { evaluateInspection, inspectionPlan } from "@/lib/aql";
import type { QcReportInput } from "@/lib/validation/operations";
import { REWORK_STAGE, stageLabel } from "@/lib/workflow";
import type { Actor } from "@/server/actor";
import { assertRole } from "@/server/access";
import { conflict, invalid, notFound } from "@/server/errors";
import { logActivity, notify, notifyAdmins } from "@/server/events";
import { deleteStoredFile, saveUpload, type StoredFile } from "@/server/storage";
import { completeStage, loadOrder, rollbackForRework } from "./orders";

async function storeAll(files: File[], folder: string) {
  const stored: StoredFile[] = [];
  try {
    for (const f of files) stored.push(await saveUpload(f, folder, { imagesOnly: true }));
    return stored;
  } catch (e) {
    await Promise.all(stored.map((s) => deleteStoredFile(s.fileKey)));
    throw e;
  }
}

// ───────────────────────────── Sampling ─────────────────────────────

export async function submitSample(actor: Actor, orderId: string, input: { description: string; revisionNotes?: string }, photos: File[]) {
  assertRole(actor, "MANUFACTURER");
  if (!photos.length) throw invalid("Add at least one photo of the sample.", { photos: "Add at least one photo of the sample." });
  if (photos.length > 10) throw invalid("Upload up to 10 photos per sample.", { photos: "Upload up to 10 photos per sample." });
  const order = await loadOrder(db, actor, orderId);
  if (order.currentStage !== "SAMPLING") throw conflict("Samples can be submitted during the sampling stage.");
  const stored = await storeAll(photos, "samples");
  try {
    return await db.$transaction(async (tx) => {
      const pending = await tx.sample.count({ where: { orderId, status: "SUBMITTED" } });
      if (pending) throw conflict("A sample is already waiting for the brand's review.");
      const round = (await tx.sample.count({ where: { orderId } })) + 1;
      const sample = await tx.sample.create({
        data: { orderId, round, description: input.description, revisionNotes: input.revisionNotes, submittedById: actor.id, photos: { create: stored } },
      });
      await tx.productionMilestone.update({ where: { orderId_stage: { orderId, stage: "SAMPLING" } }, data: { status: "AWAITING_APPROVAL" } });
      await notify(tx, order.brandId, "SAMPLE_SUBMITTED", "Sample ready for review", `Sample round ${round} for order ${order.reference} (${order.project.name}) is waiting for your decision.`, `/orders/${orderId}?tab=samples`);
      await logActivity(tx, { actorId: actor.id, orderId, projectId: order.projectId, type: "SAMPLE_SUBMITTED", message: `Sample round ${round} submitted with ${stored.length} photo(s).` });
      return sample;
    });
  } catch (e) {
    await Promise.all(stored.map((s) => deleteStoredFile(s.fileKey)));
    throw e;
  }
}

export async function reviewSample(actor: Actor, sampleId: string, decision: "APPROVED" | "REJECTED" | "REVISION_REQUESTED", feedback?: string) {
  assertRole(actor, "BRAND");
  if (decision !== "APPROVED" && !feedback) throw invalid("Explain what needs to change.", { feedback: "Explain what needs to change." });
  await db.$transaction(async (tx) => {
    const sample = await tx.sample.findFirst({ where: { id: sampleId, order: { brandId: actor.id } }, include: { order: true } });
    if (!sample) throw notFound("Sample");
    const updated = await tx.sample.updateMany({
      where: { id: sample.id, status: "SUBMITTED" },
      data: { status: decision, feedback, reviewedById: actor.id, reviewedAt: new Date() },
    });
    if (!updated.count) throw conflict("This sample has already been reviewed.");
    const label = { APPROVED: "approved", REJECTED: "rejected", REVISION_REQUESTED: "returned for revision" }[decision];
    await logActivity(tx, { actorId: actor.id, orderId: sample.orderId, projectId: sample.order.projectId, type: `SAMPLE_${decision}`, message: `Sample round ${sample.round} ${label}${feedback ? `: ${feedback}` : "."}` });
    await notify(tx, sample.order.manufacturerId, "SAMPLE_DECISION", `Sample ${label}`, `Round ${sample.round} for order ${sample.order.reference} was ${label}${feedback ? `: ${feedback}` : "."}`, `/orders/${sample.orderId}?tab=samples`);
    if (decision === "APPROVED") {
      await completeStage(tx, sample.orderId, "SAMPLING", actor.id, `Sample round ${sample.round} approved.`);
    } else {
      await tx.productionMilestone.update({ where: { orderId_stage: { orderId: sample.orderId, stage: "SAMPLING" } }, data: { status: "IN_PROGRESS" } });
    }
  });
}

// ───────────────────────────── Quality control ─────────────────────────────

/**
 * Records an inspection. The result is calculated on the server from the configured AQL plan,
 * never chosen by the inspector. A failed batch immediately creates a rework task and moves the
 * order back to the rework stage; a passed batch waits for the brand's acceptance.
 */
export async function submitQcReport(actor: Actor, orderId: string, input: QcReportInput, photos: File[]) {
  assertRole(actor, "MANUFACTURER", "ADMIN");
  if (photos.length > 20) throw invalid("Upload up to 20 photos per report.", { photos: "Upload up to 20 photos per report." });
  const order = await loadOrder(db, actor, orderId);
  if (order.currentStage !== "QUALITY_CONTROL") throw conflict("Inspections are recorded during the quality check stage.");
  const plan = inspectionPlan(input.batchSize, input.aqlMajor, input.aqlMinor);
  if (input.sampleSize < plan.sampleSize) {
    throw invalid(`The sampling plan requires at least ${plan.sampleSize} units to be inspected for a batch of ${input.batchSize}.`, {
      sampleSize: `Inspect at least ${plan.sampleSize} units (code letter ${plan.major.codeLetter}).`,
    });
  }
  const counts = { critical: 0, major: 0, minor: 0 };
  for (const d of input.defects) counts[d.severity.toLowerCase() as keyof typeof counts] += d.count;
  const evaluation = evaluateInspection(plan, counts);
  const defective = counts.critical + counts.major + counts.minor;
  const stored = await storeAll(photos, "qc");
  try {
    return await db.$transaction(async (tx) => {
      const pending = await tx.qCReport.count({ where: { orderId, result: "PASS", brandDecision: "PENDING" } });
      if (pending) throw conflict("A passed inspection is already waiting for the brand's decision.");
      const report = await tx.qCReport.create({
        data: {
          orderId,
          inspectorId: actor.id,
          inspectionDate: input.inspectionDate,
          batchSize: input.batchSize,
          sampleSize: input.sampleSize,
          inspectionStandard: plan.standard,
          aqlMajor: input.aqlMajor,
          aqlMinor: input.aqlMinor,
          acceptMajor: plan.major.accept,
          acceptMinor: plan.minor.accept,
          criticalCount: counts.critical,
          majorCount: counts.major,
          minorCount: counts.minor,
          defectiveCount: defective,
          defectRate: ((defective / input.sampleSize) * 100).toFixed(2),
          defectDescriptions: evaluation.reasons.join(" ") || null,
          correctiveActions: input.correctiveActions,
          notes: input.notes,
          result: evaluation.result,
          defects: { create: input.defects },
          photos: { create: stored },
        },
      });
      if (evaluation.result === "FAIL") {
        await tx.reworkTask.create({
          data: { orderId, qcReportId: report.id, description: [...evaluation.reasons, input.correctiveActions && `Corrective actions: ${input.correctiveActions}`].filter(Boolean).join(" ") },
        });
        await rollbackForRework(tx, orderId);
        const msg = `Inspection failed for order ${order.reference}: ${evaluation.reasons.join(" ")} Production returned to ${stageLabel(REWORK_STAGE).toLowerCase()} for rework.`;
        await notify(tx, [order.brandId, order.manufacturerId].filter((id) => id !== actor.id), "QC_OUTCOME", "Inspection failed — rework required", msg, `/orders/${orderId}?tab=samples`);
        await notifyAdmins(tx, "QC_OUTCOME", "Failed inspection", msg, `/admin/qc`);
        await logActivity(tx, { actorId: actor.id, orderId, projectId: order.projectId, type: "QC_FAILED", message: msg });
      } else {
        await tx.productionMilestone.update({ where: { orderId_stage: { orderId, stage: "QUALITY_CONTROL" } }, data: { status: "AWAITING_APPROVAL" } });
        await notify(tx, order.brandId, "QC_REPORT_SUBMITTED", "Inspection passed — decision needed", `Order ${order.reference} passed inspection (${defective} defect(s) in ${input.sampleSize} units). Review and accept the report to release the goods.`, `/orders/${orderId}?tab=samples`);
        await logActivity(tx, { actorId: actor.id, orderId, projectId: order.projectId, type: "QC_PASSED", message: `Inspection passed: ${defective} defect(s) in ${input.sampleSize} units inspected.` });
      }
      return report;
    });
  } catch (e) {
    await Promise.all(stored.map((s) => deleteStoredFile(s.fileKey)));
    throw e;
  }
}

/** Brand accepts a passed inspection (QC stage completes) or rejects it, which triggers rework. */
export async function decideQcReport(actor: Actor, reportId: string, decision: "ACCEPTED" | "REJECTED", note?: string) {
  assertRole(actor, "BRAND");
  if (decision === "REJECTED" && (!note || note.length < 5)) throw invalid("Explain why the report is rejected.", { note: "Explain why the report is rejected (at least 5 characters)." });
  await db.$transaction(async (tx) => {
    const report = await tx.qCReport.findFirst({ where: { id: reportId, order: { brandId: actor.id } }, include: { order: true } });
    if (!report) throw notFound("QC report");
    if (report.result !== "PASS") throw conflict("Failed inspections already triggered rework and need no decision.");
    const updated = await tx.qCReport.updateMany({ where: { id: report.id, brandDecision: "PENDING" }, data: { brandDecision: decision, brandDecisionNote: note, decidedAt: new Date() } });
    if (!updated.count) throw conflict("A decision has already been recorded for this report.");
    const o = report.order;
    if (decision === "ACCEPTED") {
      await tx.reworkTask.updateMany({ where: { orderId: o.id, status: "OPEN" }, data: { status: "COMPLETED", resolvedAt: new Date() } });
      await completeStage(tx, o.id, "QUALITY_CONTROL", actor.id, note ?? "QC report accepted by the brand.");
      await notify(tx, o.manufacturerId, "QC_OUTCOME", "QC report accepted", `The brand accepted the inspection for order ${o.reference}. Prepare the shipment.`, `/orders/${o.id}?tab=samples`);
    } else {
      await tx.reworkTask.create({ data: { orderId: o.id, qcReportId: report.id, description: `Brand rejected the inspection: ${note}` } });
      await rollbackForRework(tx, o.id);
      await notify(tx, o.manufacturerId, "QC_OUTCOME", "QC report rejected — rework required", `The brand rejected the inspection for order ${o.reference}: ${note}`, `/orders/${o.id}?tab=samples`);
      await notifyAdmins(tx, "QC_OUTCOME", "Brand rejected an inspection", `Order ${o.reference}: ${note}`, `/admin/qc`);
    }
    await logActivity(tx, { actorId: actor.id, orderId: o.id, projectId: o.projectId, type: `QC_${decision}`, message: decision === "ACCEPTED" ? "Brand accepted the QC report." : `Brand rejected the QC report: ${note}` });
  });
}
