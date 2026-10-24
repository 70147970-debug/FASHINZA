"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { FormState } from "@/lib/form-state";
import { disputeUpdateSchema, reasonSchema } from "@/lib/validation/operations";
import { formObject, parseForm, runAction } from "@/server/action";
import { requireUser } from "@/server/auth/session";
import { setUserStatus } from "@/server/services/accounts";
import { decideVerification, reviewDocument, revokeVerification } from "@/server/services/profiles";
import { updateDispute } from "@/server/services/disputes";
import { requestRefund } from "@/server/services/payments";
import { setEnquiryStatus } from "@/server/services/admin";
import { deliverSandboxEvent, getPaymentProvider } from "@/server/payments/provider";

const admin = () => requireUser(["ADMIN"]);

export async function reviewDocumentAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const actor = await admin();
  const status = fd.get("status") === "VERIFIED" ? "VERIFIED" : "REJECTED";
  const note = String(fd.get("note") ?? "").trim() || undefined;
  const result = await runAction(async () => {
    await reviewDocument(actor, String(fd.get("documentId")), status, note);
    return status === "VERIFIED" ? "Document verified." : "Document rejected.";
  });
  revalidatePath(`/admin/factories/${fd.get("profileId")}`);
  return result;
}

export async function decideVerificationAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const actor = await admin();
  const parsed = parseForm(reasonSchema, { reason: fd.get("reason") });
  if (!parsed.ok) return parsed.state;
  const decision = fd.get("decision") === "VERIFIED" ? "VERIFIED" : "REJECTED";
  const result = await runAction(async () => {
    await decideVerification(actor, String(fd.get("profileId")), decision, parsed.data.reason);
    return decision === "VERIFIED" ? "Factory verified. It can now be matched to projects." : "Verification rejected. The factory has been told why.";
  });
  revalidatePath("/admin/factories", "layout");
  return result;
}

export async function revokeVerificationAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const actor = await admin();
  const parsed = parseForm(reasonSchema, { reason: fd.get("reason") });
  if (!parsed.ok) return parsed.state;
  const result = await runAction(async () => {
    await revokeVerification(actor, String(fd.get("profileId")), parsed.data.reason);
    return "Verification revoked.";
  });
  revalidatePath("/admin/factories", "layout");
  return result;
}

export async function setUserStatusAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const actor = await admin();
  const parsed = parseForm(reasonSchema, { reason: fd.get("reason") });
  if (!parsed.ok) return parsed.state;
  const status = fd.get("status") === "SUSPENDED" ? "SUSPENDED" : "ACTIVE";
  const result = await runAction(async () => {
    await setUserStatus(actor, String(fd.get("userId")), status, parsed.data.reason);
    return status === "SUSPENDED" ? "Account suspended and signed out." : "Account reactivated.";
  });
  revalidatePath("/admin/users");
  return result;
}

export async function updateDisputeAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const actor = await admin();
  const parsed = parseForm(disputeUpdateSchema, formObject(fd));
  if (!parsed.ok) return parsed.state;
  const id = String(fd.get("id"));
  const result = await runAction(async () => {
    await updateDispute(actor, id, parsed.data);
    return "Dispute updated and the parties notified.";
  });
  revalidatePath(`/disputes/${id}`);
  revalidatePath("/admin/disputes");
  return result;
}

export async function refundAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const actor = await admin();
  const parsed = parseForm(reasonSchema, { reason: fd.get("reason") });
  if (!parsed.ok) return parsed.state;
  const result = await runAction(async () => {
    const refund = await requestRefund(actor, String(fd.get("paymentMilestoneId")), parsed.data.reason);
    // The sandbox provider settles refunds immediately by sending its webhook; a real provider
    // would send it asynchronously once the refund clears.
    if (getPaymentProvider().isSandbox) await deliverSandboxEvent("refund.succeeded", { providerRef: refund.providerRef, amount: refund.amount, currency: refund.currency });
    return "Refund issued through the sandbox provider.";
  });
  revalidatePath("/admin/payments");
  return result;
}

const enquiry = z.object({ id: z.string(), status: z.enum(["NEW", "IN_PROGRESS", "RESOLVED"]) });
export async function setEnquiryStatusAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const actor = await admin();
  const parsed = parseForm(enquiry, formObject(fd));
  if (!parsed.ok) return parsed.state;
  const result = await runAction(async () => {
    await setEnquiryStatus(actor, parsed.data.id, parsed.data.status);
    return "Enquiry updated.";
  });
  revalidatePath("/admin/enquiries");
  return result;
}
