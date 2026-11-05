/**
 * Sampling and quality control (port of src/server/services/quality.ts).
 */
import { evaluateInspection, inspectionPlan } from "@fashinza/shared/aql.js";
import { REWORK_STAGE, stageLabel } from "@fashinza/shared/workflow.js";
import { withTransaction } from "../db.js";
import { assertRole } from "../lib/access.js";
import { conflict, invalid, notFound } from "../lib/errors.js";
import { logActivity, notify, notifyAdmins } from "../lib/events.js";
import { idOf, sameId, toObjectId } from "../lib/ids.js";
import { serialize } from "../lib/serialize.js";
import { deleteStoredFile, saveUpload } from "../lib/storage.js";
import { Order, ProductionMilestone, QCDefect, QCReport, QCReportPhoto, ReworkTask, Sample, SamplePhoto } from "../models/index.js";
import { completeStage, loadOrder, rollbackForRework } from "./orders.js";

async function storeAll(files, folder) {
  const stored = [];
  try {
    for (const f of files) stored.push(await saveUpload(f, folder, { imagesOnly: true }));
    return stored;
  } catch (e) {
    await Promise.all(stored.map((s) => deleteStoredFile(s.fileKey)));
    throw e;
  }
}

// ───────────────────────────── Sampling ─────────────────────────────

/**
 * @param {{ description: string, revisionNotes?: string }} input
 * @param {any[]} photos multer file objects
 */
export async function submitSample(actor, orderId, input, photos) {
  assertRole(actor, "MANUFACTURER");
  if (!photos.length) throw invalid("Add at least one photo of the sample.", { photos: "Add at least one photo of the sample." });
  if (photos.length > 10) throw invalid("Upload up to 10 photos per sample.", { photos: "Upload up to 10 photos per sample." });
  const order = await loadOrder(null, actor, orderId);
  if (order.currentStage !== "SAMPLING") throw conflict("Samples can be submitted during the sampling stage.");
  const stored = await storeAll(photos, "samples");
  try {
    return await withTransaction(async (session) => {
      const pending = await Sample.countDocuments({ orderId: order._id, status: "SUBMITTED" }).session(session);
      if (pending) throw conflict("A sample is already waiting for the brand's review.");
      const round = (await Sample.countDocuments({ orderId: order._id }).session(session)) + 1;
      const [sample] = await Sample.create(
        [{ orderId: order._id, round, description: input.description, revisionNotes: input.revisionNotes ?? null, submittedById: toObjectId(actor.id) }],
        { session },
      );
      if (stored.length) await SamplePhoto.insertMany(stored.map((s) => ({ sampleId: sample._id, ...s })), { session });
      await ProductionMilestone.updateOne({ orderId: order._id, stage: "SAMPLING" }, { $set: { status: "AWAITING_APPROVAL" } }, { session });
      const oid = idOf(order._id);
      await notify(
        session,
        order.brandId,
        "SAMPLE_SUBMITTED",
        "Sample ready for review",
        `Sample round ${round} for order ${order.reference} (${order.project?.name}) is waiting for your decision.`,
        `/orders/${oid}?tab=samples`,
      );
      await logActivity(session, {
        actorId: actor.id,
        orderId: order._id,
        projectId: order.projectId,
        type: "SAMPLE_SUBMITTED",
        message: `Sample round ${round} submitted with ${stored.length} photo(s).`,
      });
      return serialize(Sample, sample);
    });
  } catch (e) {
    await Promise.all(stored.map((s) => deleteStoredFile(s.fileKey)));
    throw e;
  }
}

/** @param {"APPROVED" | "REJECTED" | "REVISION_REQUESTED"} decision */
export async function reviewSample(actor, sampleId, decision, feedback) {
  assertRole(actor, "BRAND");
  if (decision !== "APPROVED" && !feedback) throw invalid("Explain what needs to change.", { feedback: "Explain what needs to change." });
  await withTransaction(async (session) => {
    const sid = toObjectId(sampleId);
    const found = sid ? await Sample.findById(sid).session(session).lean() : null;
    const order = found ? await Order.findById(found.orderId).session(session).lean() : null;
    if (!found || !order || !sameId(order.brandId, actor.id)) throw notFound("Sample");
    const sample = found;
    const updated = await Sample.updateOne(
      { _id: sample._id, status: "SUBMITTED" },
      { $set: { status: decision, feedback: feedback ?? null, reviewedById: toObjectId(actor.id), reviewedAt: new Date() } },
      { session },
    );
    if (!updated.modifiedCount) throw conflict("This sample has already been reviewed.");
    const label = { APPROVED: "approved", REJECTED: "rejected", REVISION_REQUESTED: "returned for revision" }[decision];
    const oid = idOf(sample.orderId);
    await logActivity(session, {
      actorId: actor.id,
      orderId: sample.orderId,
      projectId: order.projectId,
      type: `SAMPLE_${decision}`,
      message: `Sample round ${sample.round} ${label}${feedback ? `: ${feedback}` : "."}`,
    });
    await notify(
      session,
      order.manufacturerId,
      "SAMPLE_DECISION",
      `Sample ${label}`,
      `Round ${sample.round} for order ${order.reference} was ${label}${feedback ? `: ${feedback}` : "."}`,
      `/orders/${oid}?tab=samples`,
    );
    if (decision === "APPROVED") {
      await completeStage(session, oid, "SAMPLING", actor.id, `Sample round ${sample.round} approved.`);
    } else {
      await ProductionMilestone.updateOne({ orderId: sample.orderId, stage: "SAMPLING" }, { $set: { status: "IN_PROGRESS" } }, { session });
    }
  });
}

// ───────────────────────────── Quality control ─────────────────────────────

/**
 * Records an inspection. The result is calculated on the server from the configured AQL plan,
 * never chosen by the inspector. A failed batch immediately creates a rework task and moves the
 * order back to the rework stage; a passed batch waits for the brand's acceptance.
 * @param {import("@fashinza/shared/validation/operations.js").QcReportInput} input
 * @param {any[]} photos multer file objects
 */
export async function submitQcReport(actor, orderId, input, photos) {
  assertRole(actor, "MANUFACTURER", "ADMIN");
  if (photos.length > 20) throw invalid("Upload up to 20 photos per report.", { photos: "Upload up to 20 photos per report." });
  const order = await loadOrder(null, actor, orderId);
  if (order.currentStage !== "QUALITY_CONTROL") throw conflict("Inspections are recorded during the quality check stage.");
  const plan = inspectionPlan(input.batchSize, input.aqlMajor, input.aqlMinor);
  if (input.sampleSize < plan.sampleSize) {
    throw invalid(`The sampling plan requires at least ${plan.sampleSize} units to be inspected for a batch of ${input.batchSize}.`, {
      sampleSize: `Inspect at least ${plan.sampleSize} units (code letter ${plan.major.codeLetter}).`,
    });
  }
  const defects = input.defects ?? [];
  const counts = { critical: 0, major: 0, minor: 0 };
  for (const d of defects) counts[d.severity.toLowerCase()] += d.count;
  const evaluation = evaluateInspection(plan, counts);
  const defective = counts.critical + counts.major + counts.minor;
  const stored = await storeAll(photos, "qc");
  const oid = idOf(order._id);
  try {
    return await withTransaction(async (session) => {
      const pending = await QCReport.countDocuments({ orderId: order._id, result: "PASS", brandDecision: "PENDING" }).session(session);
      if (pending) throw conflict("A passed inspection is already waiting for the brand's decision.");
      const [report] = await QCReport.create(
        [
          {
            orderId: order._id,
            inspectorId: toObjectId(actor.id),
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
            correctiveActions: input.correctiveActions ?? null,
            notes: input.notes ?? null,
            result: evaluation.result,
          },
        ],
        { session },
      );
      if (defects.length) await QCDefect.insertMany(defects.map((d) => ({ reportId: report._id, category: d.category, severity: d.severity, count: d.count })), { session });
      if (stored.length) await QCReportPhoto.insertMany(stored.map((s) => ({ reportId: report._id, ...s })), { session });
      if (evaluation.result === "FAIL") {
        await ReworkTask.create(
          [
            {
              orderId: order._id,
              qcReportId: report._id,
              description: [...evaluation.reasons, input.correctiveActions && `Corrective actions: ${input.correctiveActions}`].filter(Boolean).join(" "),
            },
          ],
          { session },
        );
        await rollbackForRework(session, oid);
        const msg = `Inspection failed for order ${order.reference}: ${evaluation.reasons.join(" ")} Production returned to ${stageLabel(REWORK_STAGE).toLowerCase()} for rework.`;
        await notify(
          session,
          [idOf(order.brandId), idOf(order.manufacturerId)].filter((id) => id !== actor.id),
          "QC_OUTCOME",
          "Inspection failed — rework required",
          msg,
          `/orders/${oid}?tab=samples`,
        );
        await notifyAdmins(session, "QC_OUTCOME", "Failed inspection", msg, `/admin/qc`);
        await logActivity(session, { actorId: actor.id, orderId: order._id, projectId: order.projectId, type: "QC_FAILED", message: msg });
      } else {
        await ProductionMilestone.updateOne({ orderId: order._id, stage: "QUALITY_CONTROL" }, { $set: { status: "AWAITING_APPROVAL" } }, { session });
        await notify(
          session,
          order.brandId,
          "QC_REPORT_SUBMITTED",
          "Inspection passed — decision needed",
          `Order ${order.reference} passed inspection (${defective} defect(s) in ${input.sampleSize} units). Review and accept the report to release the goods.`,
          `/orders/${oid}?tab=samples`,
        );
        await logActivity(session, {
          actorId: actor.id,
          orderId: order._id,
          projectId: order.projectId,
          type: "QC_PASSED",
          message: `Inspection passed: ${defective} defect(s) in ${input.sampleSize} units inspected.`,
        });
      }
      return serialize(QCReport, report);
    });
  } catch (e) {
    await Promise.all(stored.map((s) => deleteStoredFile(s.fileKey)));
    throw e;
  }
}

/**
 * Brand accepts a passed inspection (QC stage completes) or rejects it, which triggers rework.
 * @param {"ACCEPTED" | "REJECTED"} decision
 */
export async function decideQcReport(actor, reportId, decision, note) {
  assertRole(actor, "BRAND");
  if (decision === "REJECTED" && (!note || note.length < 5)) throw invalid("Explain why the report is rejected.", { note: "Explain why the report is rejected (at least 5 characters)." });
  await withTransaction(async (session) => {
    const rid = toObjectId(reportId);
    const report = rid ? await QCReport.findById(rid).session(session).lean() : null;
    const o = report ? await Order.findById(report.orderId).session(session).lean() : null;
    if (!report || !o || !sameId(o.brandId, actor.id)) throw notFound("QC report");
    if (report.result !== "PASS") throw conflict("Failed inspections already triggered rework and need no decision.");
    const updated = await QCReport.updateOne(
      { _id: report._id, brandDecision: "PENDING" },
      { $set: { brandDecision: decision, brandDecisionNote: note ?? null, decidedAt: new Date() } },
      { session },
    );
    if (!updated.modifiedCount) throw conflict("A decision has already been recorded for this report.");
    const oid = idOf(o._id);
    if (decision === "ACCEPTED") {
      await ReworkTask.updateMany({ orderId: o._id, status: "OPEN" }, { $set: { status: "COMPLETED", resolvedAt: new Date() } }, { session });
      await completeStage(session, oid, "QUALITY_CONTROL", actor.id, note ?? "QC report accepted by the brand.");
      await notify(session, o.manufacturerId, "QC_OUTCOME", "QC report accepted", `The brand accepted the inspection for order ${o.reference}. Prepare the shipment.`, `/orders/${oid}?tab=samples`);
    } else {
      await ReworkTask.create([{ orderId: o._id, qcReportId: report._id, description: `Brand rejected the inspection: ${note}` }], { session });
      await rollbackForRework(session, oid);
      await notify(session, o.manufacturerId, "QC_OUTCOME", "QC report rejected — rework required", `The brand rejected the inspection for order ${o.reference}: ${note}`, `/orders/${oid}?tab=samples`);
      await notifyAdmins(session, "QC_OUTCOME", "Brand rejected an inspection", `Order ${o.reference}: ${note}`, `/admin/qc`);
    }
    await logActivity(session, {
      actorId: actor.id,
      orderId: o._id,
      projectId: o.projectId,
      type: `QC_${decision}`,
      message: decision === "ACCEPTED" ? "Brand accepted the QC report." : `Brand rejected the QC report: ${note}`,
    });
  });
}
