/**
 * Orders, milestones, samples, QC, shipment, messages, payment schedule (mounted at /api/orders) — owner:
 * SERVER-B (docs/mern/api.md §6.1). Ports of the server actions in src/app/(app)/orders/actions.ts and the
 * data loading of the /orders and /orders/[id] pages. Checks run in the same order as the original actions:
 * sign-in/role → form validation → service rules.
 */
import { Router } from "express";
import { z } from "zod";
import { OrderStatus } from "@fashinza/shared/enums.js";
import { STAGES } from "@fashinza/shared/workflow.js";
import {
  evidenceNoteSchema,
  messageSchema,
  paymentScheduleSchema,
  qcReportSchema,
  sampleReviewSchema,
  sampleSchema,
  shipmentSchema,
} from "@fashinza/shared/validation/operations.js";
import { invalid } from "../lib/errors.js";
import { filesOf, ok, parseForm, readForm } from "../lib/form.js";
import { oneOf, pageParam, pageSizeParam, queryString } from "../lib/query.js";
import { requireOnboardedUser } from "../middleware/auth.js";
import { addEvidence, completeEvidenceStage, confirmDelivery, getOrder, listOrders, postMessage, recordShipment, refreshDelays } from "../services/orders.js";
import { updatePaymentSchedule } from "../services/payments.js";
import { decideQcReport, reviewSample, submitQcReport, submitSample } from "../services/quality.js";

const router = Router();

/** `stageOf(fd)` of the original actions. */
const stageOf = (form) => {
  const s = String(form.stage ?? null);
  if (!STAGES.some((x) => x.stage === s)) throw invalid("Unknown stage.");
  return s;
};

/** `String(fd.get("note") ?? "").trim() || undefined` */
const trimmedNote = (form) => (typeof form.note === "string" ? form.note.trim() : "") || undefined;

const validated = (schema, data) => {
  const parsed = parseForm(schema, data);
  if (!parsed.ok) throw parsed.error;
  return parsed.data;
};

// ───────────── page data ─────────────

router.get("/", requireOnboardedUser(), async (req, res) => {
  await refreshDelays();
  const status = queryString(req, "status");
  const attention = queryString(req, "attention");
  const data = await listOrders(req.actor, {
    q: queryString(req, "q") || undefined,
    status: status === "ACTIVE" ? "ACTIVE" : oneOf(OrderStatus, status),
    delayed: queryString(req, "delayed") === "1",
    attention: attention === "samples" || attention === "qc" ? attention : undefined,
    page: pageParam(req),
    pageSize: pageSizeParam(req),
  });
  res.json(data);
});

router.get("/:id", requireOnboardedUser(), async (req, res) => {
  res.json({ order: await getOrder(req.actor, req.params.id) });
});

// ───────────── production ─────────────

router.post("/:id/evidence", requireOnboardedUser(["MANUFACTURER"]), async (req, res) => {
  const form = readForm(req);
  const { note } = validated(evidenceNoteSchema, form);
  const list = filesOf(req, "file");
  if (!list.length) throw invalid("Choose a photo or document.", { file: "Choose a photo or document." });
  for (const f of list.slice(0, 10)) await addEvidence(req.actor, req.params.id, stageOf(form), f, note);
  ok(res, { message: `${Math.min(list.length, 10)} evidence file${list.length === 1 ? "" : "s"} added.` });
});

router.post("/:id/stages/complete", requireOnboardedUser(["MANUFACTURER"]), async (req, res) => {
  const form = readForm(req);
  await completeEvidenceStage(req.actor, req.params.id, stageOf(form), trimmedNote(form));
  ok(res, { message: "Stage completed. The brand has been notified." });
});

router.post("/:id/shipment", requireOnboardedUser(["MANUFACTURER"]), async (req, res) => {
  const data = validated(shipmentSchema, readForm(req));
  await recordShipment(req.actor, req.params.id, data.carrier, data.trackingNumber);
  ok(res, { message: "Shipment recorded. The brand has the tracking details." });
});

router.post("/:id/delivery", requireOnboardedUser(["BRAND"]), async (req, res) => {
  await confirmDelivery(req.actor, req.params.id, trimmedNote(readForm(req)));
  ok(res, { message: "Delivery confirmed. The order is complete." });
});

// ───────────── samples & QC ─────────────

router.post("/:id/samples", requireOnboardedUser(["MANUFACTURER"]), async (req, res) => {
  const data = validated(sampleSchema, readForm(req));
  await submitSample(req.actor, req.params.id, data, filesOf(req, "photos"));
  ok(res, { message: "Sample submitted for the brand's review." });
});

router.post("/:id/samples/:sampleId/review", requireOnboardedUser(["BRAND"]), async (req, res) => {
  const data = validated(sampleReviewSchema, readForm(req));
  await reviewSample(req.actor, req.params.sampleId, data.decision, data.feedback);
  ok(res, { message: data.decision === "APPROVED" ? "Sample approved. Production moves to cutting." : "Decision sent to the factory." });
});

router.post("/:id/qc-reports", requireOnboardedUser(["MANUFACTURER", "ADMIN"]), async (req, res) => {
  const form = readForm(req);
  let defects = [];
  if (Array.isArray(form.defects)) {
    defects = form.defects;
  } else {
    try {
      defects = JSON.parse(String(form.defects || "[]"));
    } catch {
      throw invalid("The defect list could not be read. Please re-enter it.");
    }
  }
  const data = validated(qcReportSchema, { ...form, defects });
  const report = await submitQcReport(req.actor, req.params.id, data, filesOf(req, "photos"));
  ok(res, {
    message:
      report.result === "PASS"
        ? "Inspection recorded: PASS. Waiting for the brand to accept it."
        : "Inspection recorded: FAIL. A rework task was created and production returned to stitching.",
  });
});

router.post("/:id/qc-reports/:reportId/decision", requireOnboardedUser(["BRAND"]), async (req, res) => {
  const form = readForm(req);
  const decision = form.decision === "ACCEPTED" ? "ACCEPTED" : "REJECTED";
  await decideQcReport(req.actor, req.params.reportId, decision, trimmedNote(form));
  ok(res, { message: decision === "ACCEPTED" ? "QC report accepted. The factory can now ship." : "Report rejected. The order went back to rework." });
});

// ───────────── messages ─────────────

router.post("/:id/messages", requireOnboardedUser(), async (req, res) => {
  const data = validated(messageSchema, readForm(req));
  await postMessage(req.actor, req.params.id, data.body, data.milestoneId);
  ok(res, { message: "Message sent." });
});

// ───────────── payment schedule ─────────────

const scheduleInput = z.object({ items: z.string() });

router.put("/:id/payment-schedule", requireOnboardedUser(["BRAND"]), async (req, res) => {
  const form = readForm(req);
  let items = [];
  if (Array.isArray(form.items)) {
    // JSON bodies may send the array itself (docs/mern/api.md §3.10).
    items = form.items;
  } else {
    const raw = scheduleInput.safeParse({ items: form.items });
    try {
      items = raw.success ? JSON.parse(raw.data.items) : [];
    } catch {
      throw invalid("The schedule could not be read.");
    }
  }
  const parsed = parseForm(paymentScheduleSchema, { items });
  if (!parsed.ok) {
    const fieldErrors = parsed.error.fieldErrors ?? {};
    throw invalid(fieldErrors.items ?? "Check the payment shares: they must be above 0% and add up to 100%.", fieldErrors);
  }
  await updatePaymentSchedule(req.actor, req.params.id, parsed.data.items);
  ok(res, { message: "Payment schedule updated." });
});

export default router;
