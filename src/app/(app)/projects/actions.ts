"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "@/lib/form-state";
import { ARRAY_FIELDS, PROJECT_STEPS } from "@/lib/validation/project";
import { decisionNoteSchema } from "@/lib/validation/quotation";
import { reasonSchema } from "@/lib/validation/operations";
import { parseForm, runAction } from "@/server/action";
import { requireOnboardedUser } from "@/server/auth/session";
import { cancelProject, deleteAttachment, deleteDraft, rerunMatching, saveProject, submitProject } from "@/server/services/projects";
import { acceptQuotation, rejectQuotation, requestRevision } from "@/server/services/quotations";

/** Saves one wizard step. Only that step's fields are sent, so other steps are never overwritten. */
export async function saveProjectStepAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireOnboardedUser(["BRAND"]);
  const step = Number(formData.get("step"));
  const def = PROJECT_STEPS.find((s) => s.step === step);
  if (!def) return { status: "error", message: "Unknown step." };
  const raw: Record<string, unknown> = {};
  for (const field of def.fields) {
    raw[field] = (ARRAY_FIELDS as readonly string[]).includes(field)
      ? formData.getAll(field).map(String).filter((v) => v.trim())
      : String(formData.get(field) ?? "");
  }
  const projectId = String(formData.get("projectId") ?? "") || null;
  const intent = String(formData.get("intent") ?? "next");
  let id = projectId;
  const result = await runAction(async () => {
    id = await saveProject(actor, projectId, raw, step);
  });
  if (result.status === "error") return result;
  // Navigating actions do not also revalidate: the destination is dynamic and fetched fresh.
  if (String(formData.get("submitted")) === "1") return { status: "success", redirectTo: `/projects/${id}?updated=1` };
  if (intent === "next") return { status: "success", redirectTo: `/projects/${id}/edit?step=${step + 1}` };
  if (!projectId) return { status: "success", redirectTo: `/projects/${id}/edit?step=${step}&saved=1` };
  revalidatePath(`/projects/${id}/edit`);
  return { status: "success", message: "Draft saved." };
}

export async function submitProjectAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireOnboardedUser(["BRAND"]);
  const id = String(formData.get("projectId"));
  const result = await runAction(async () => {
    await submitProject(actor, id);
  });
  if (result.status === "error") return result;
  return { status: "success", redirectTo: `/projects/${id}?submitted=1` };
}

export async function rerunMatchingAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireOnboardedUser(["BRAND"]);
  const id = String(formData.get("projectId"));
  const result = await runAction(async () => {
    const s = await rerunMatching(actor, id);
    return `Matching reviewed ${s.reviewed} factories: ${s.eligible} eligible, ${s.newlyInvited} newly invited.`;
  });
  revalidatePath(`/projects/${id}`);
  return result;
}

export async function cancelProjectAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireOnboardedUser(["BRAND"]);
  const parsed = parseForm(reasonSchema, { reason: formData.get("reason") });
  if (!parsed.ok) return parsed.state;
  const id = String(formData.get("projectId"));
  const result = await runAction(async () => {
    await cancelProject(actor, id, parsed.data.reason);
    return "Project cancelled.";
  });
  revalidatePath(`/projects/${id}`);
  revalidatePath("/projects");
  return result;
}

export async function deleteDraftAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireOnboardedUser(["BRAND"]);
  const result = await runAction(async () => {
    await deleteDraft(actor, String(formData.get("projectId")));
  });
  if (result.status === "error") return result;
  return { status: "success", redirectTo: "/projects?deleted=1" };
}

export async function deleteAttachmentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireOnboardedUser(["BRAND"]);
  const result = await runAction(async () => {
    await deleteAttachment(actor, String(formData.get("attachmentId")));
    return "File removed.";
  });
  revalidatePath(`/projects/${formData.get("projectId")}`, "layout");
  return result;
}

export async function requestRevisionAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireOnboardedUser(["BRAND"]);
  const parsed = parseForm(decisionNoteSchema, { note: formData.get("note") });
  if (!parsed.ok) return parsed.state;
  const result = await runAction(async () => {
    await requestRevision(actor, String(formData.get("quotationId")), parsed.data.note);
    return "Revision requested. The factory has been notified.";
  });
  revalidatePath(`/projects/${formData.get("projectId")}`);
  return result;
}

export async function rejectQuotationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireOnboardedUser(["BRAND"]);
  const parsed = parseForm(decisionNoteSchema, { note: formData.get("note") });
  if (!parsed.ok) return parsed.state;
  const result = await runAction(async () => {
    await rejectQuotation(actor, String(formData.get("quotationId")), parsed.data.note);
    return "Quotation declined.";
  });
  revalidatePath(`/projects/${formData.get("projectId")}`);
  return result;
}

export async function acceptQuotationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireOnboardedUser(["BRAND"]);
  let orderId = "";
  const result = await runAction(async () => {
    orderId = (await acceptQuotation(actor, String(formData.get("quotationId")))).id;
  });
  if (result.status === "error") return result;
  return { status: "success", redirectTo: `/orders/${orderId}?created=1` };
}
