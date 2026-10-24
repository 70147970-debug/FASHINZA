"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { FormState } from "@/lib/form-state";
import type { MilestoneStage } from "@/generated/prisma/enums";
import { STAGES } from "@/lib/workflow";
import { disputeSchema, evidenceNoteSchema, messageSchema, paymentScheduleSchema, qcReportSchema, sampleReviewSchema, sampleSchema, shipmentSchema } from "@/lib/validation/operations";
import { files, formObject, parseForm, runAction } from "@/server/action";
import { requireOnboardedUser } from "@/server/auth/session";
import { addEvidence, completeEvidenceStage, confirmDelivery, postMessage, recordShipment } from "@/server/services/orders";
import { decideQcReport, reviewSample, submitQcReport, submitSample } from "@/server/services/quality";
import { startPayment, updatePaymentSchedule } from "@/server/services/payments";
import { raiseDispute } from "@/server/services/disputes";
import { invalid } from "@/server/errors";

const stageOf = (fd: FormData) => {
  const s = String(fd.get("stage"));
  if (!STAGES.some((x) => x.stage === s)) throw invalid("Unknown stage.");
  return s as MilestoneStage;
};
const done = (orderId: string) => revalidatePath(`/orders/${orderId}`);

export async function addEvidenceAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const actor = await requireOnboardedUser(["MANUFACTURER"]);
  const orderId = String(fd.get("orderId"));
  const parsed = parseForm(evidenceNoteSchema, formObject(fd));
  if (!parsed.ok) return parsed.state;
  const result = await runAction(async () => {
    const list = files(fd, "file");
    if (!list.length) throw invalid("Choose a photo or document.", { file: "Choose a photo or document." });
    for (const f of list.slice(0, 10)) await addEvidence(actor, orderId, stageOf(fd), f, parsed.data.note);
    return `${Math.min(list.length, 10)} evidence file${list.length === 1 ? "" : "s"} added.`;
  });
  done(orderId);
  return result;
}

export async function completeStageAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const actor = await requireOnboardedUser(["MANUFACTURER"]);
  const orderId = String(fd.get("orderId"));
  const result = await runAction(async () => {
    await completeEvidenceStage(actor, orderId, stageOf(fd), String(fd.get("note") ?? "").trim() || undefined);
    return "Stage completed. The brand has been notified.";
  });
  done(orderId);
  return result;
}

export async function submitSampleAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const actor = await requireOnboardedUser(["MANUFACTURER"]);
  const orderId = String(fd.get("orderId"));
  const parsed = parseForm(sampleSchema, formObject(fd));
  if (!parsed.ok) return parsed.state;
  const result = await runAction(async () => {
    await submitSample(actor, orderId, parsed.data, files(fd, "photos"));
    return "Sample submitted for the brand's review.";
  });
  done(orderId);
  return result;
}

export async function reviewSampleAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const actor = await requireOnboardedUser(["BRAND"]);
  const orderId = String(fd.get("orderId"));
  const parsed = parseForm(sampleReviewSchema, formObject(fd));
  if (!parsed.ok) return parsed.state;
  const result = await runAction(async () => {
    await reviewSample(actor, String(fd.get("sampleId")), parsed.data.decision, parsed.data.feedback);
    return parsed.data.decision === "APPROVED" ? "Sample approved. Production moves to cutting." : "Decision sent to the factory.";
  });
  done(orderId);
  return result;
}

export async function submitQcAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const actor = await requireOnboardedUser(["MANUFACTURER", "ADMIN"]);
  const orderId = String(fd.get("orderId"));
  let defects: unknown = [];
  try {
    defects = JSON.parse(String(fd.get("defects") || "[]"));
  } catch {
    return { status: "error", message: "The defect list could not be read. Please re-enter it." };
  }
  const parsed = parseForm(qcReportSchema, { ...formObject(fd), defects });
  if (!parsed.ok) return parsed.state;
  const result = await runAction(async () => {
    const r = await submitQcReport(actor, orderId, parsed.data, files(fd, "photos"));
    return r.result === "PASS" ? "Inspection recorded: PASS. Waiting for the brand to accept it." : "Inspection recorded: FAIL. A rework task was created and production returned to stitching.";
  });
  done(orderId);
  return result;
}

export async function decideQcAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const actor = await requireOnboardedUser(["BRAND"]);
  const orderId = String(fd.get("orderId"));
  const decision = fd.get("decision") === "ACCEPTED" ? "ACCEPTED" : "REJECTED";
  const result = await runAction(async () => {
    await decideQcReport(actor, String(fd.get("reportId")), decision, String(fd.get("note") ?? "").trim() || undefined);
    return decision === "ACCEPTED" ? "QC report accepted. The factory can now ship." : "Report rejected. The order went back to rework.";
  });
  done(orderId);
  return result;
}

export async function recordShipmentAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const actor = await requireOnboardedUser(["MANUFACTURER"]);
  const orderId = String(fd.get("orderId"));
  const parsed = parseForm(shipmentSchema, formObject(fd));
  if (!parsed.ok) return parsed.state;
  const result = await runAction(async () => {
    await recordShipment(actor, orderId, parsed.data.carrier, parsed.data.trackingNumber);
    return "Shipment recorded. The brand has the tracking details.";
  });
  done(orderId);
  return result;
}

export async function confirmDeliveryAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const actor = await requireOnboardedUser(["BRAND"]);
  const orderId = String(fd.get("orderId"));
  const result = await runAction(async () => {
    await confirmDelivery(actor, orderId, String(fd.get("note") ?? "").trim() || undefined);
    return "Delivery confirmed. The order is complete.";
  });
  done(orderId);
  return result;
}

export async function postMessageAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const actor = await requireOnboardedUser();
  const orderId = String(fd.get("orderId"));
  const parsed = parseForm(messageSchema, formObject(fd));
  if (!parsed.ok) return parsed.state;
  const result = await runAction(async () => {
    await postMessage(actor, orderId, parsed.data.body, parsed.data.milestoneId);
    return "Message sent.";
  });
  done(orderId);
  return result;
}

export async function startPaymentAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const actor = await requireOnboardedUser(["BRAND"]);
  let url = "";
  const result = await runAction(async () => {
    url = await startPayment(actor, String(fd.get("paymentMilestoneId")));
  });
  if (result.status === "error") return result;
  return { status: "success", redirectTo: url };
}

const scheduleInput = z.object({ items: z.string() });
export async function updateScheduleAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const actor = await requireOnboardedUser(["BRAND"]);
  const orderId = String(fd.get("orderId"));
  const raw = scheduleInput.safeParse({ items: fd.get("items") });
  let items: unknown = [];
  try {
    items = raw.success ? JSON.parse(raw.data.items) : [];
  } catch {
    return { status: "error", message: "The schedule could not be read." };
  }
  const parsed = parseForm(paymentScheduleSchema, { items });
  if (!parsed.ok) return { ...parsed.state, message: parsed.state.fieldErrors?.items ?? "Check the payment shares: they must be above 0% and add up to 100%." };
  const result = await runAction(async () => {
    await updatePaymentSchedule(actor, orderId, parsed.data.items);
    return "Payment schedule updated.";
  });
  done(orderId);
  return result;
}

export async function raiseDisputeAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const actor = await requireOnboardedUser(["BRAND", "MANUFACTURER"]);
  const parsed = parseForm(disputeSchema, formObject(fd));
  if (!parsed.ok) return parsed.state;
  let id = "";
  const result = await runAction(async () => {
    id = (await raiseDispute(actor, parsed.data)).id;
  });
  if (result.status === "error") return result;
  return { status: "success", redirectTo: `/disputes/${id}?created=1` };
}
