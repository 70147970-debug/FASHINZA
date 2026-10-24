"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "@/lib/form-state";
import { brandProfileSchema, changePasswordSchema, documentSchema, manufacturerProfileSchema } from "@/lib/validation/profile";
import { files, formObject, parseForm, runAction } from "@/server/action";
import { requireUser } from "@/server/auth/session";
import { changePassword } from "@/server/services/accounts";
import { addManufacturerDocument, deleteManufacturerDocument, requestVerification, saveBrandProfile, saveManufacturerProfile } from "@/server/services/profiles";
import { invalid } from "@/server/errors";

export async function saveBrandProfileAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireUser(["BRAND"]);
  const parsed = parseForm(brandProfileSchema, formObject(formData));
  if (!parsed.ok) return parsed.state;
  const wasOnboarding = !actor.profileCompleted;
  const result = await runAction(async () => {
    await saveBrandProfile(actor, parsed.data);
    return "Company profile saved.";
  });
  if (result.status === "success" && wasOnboarding) return { status: "success", redirectTo: "/dashboard?welcome=1" };
  revalidatePath("/", "layout");
  return result;
}

export async function saveFactoryProfileAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireUser(["MANUFACTURER"]);
  const parsed = parseForm(manufacturerProfileSchema, formObject(formData, ["categories", "production", "fabrics", "finishing"]));
  if (!parsed.ok) return parsed.state;
  const wasOnboarding = !actor.profileCompleted;
  const result = await runAction(async () => {
    await saveManufacturerProfile(actor, parsed.data);
    return "Factory profile saved.";
  });
  if (result.status === "success" && wasOnboarding) return { status: "success", redirectTo: "/factory?welcome=1" };
  revalidatePath("/", "layout");
  return result;
}

export async function uploadDocumentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireUser(["MANUFACTURER"]);
  const parsed = parseForm(documentSchema, formObject(formData));
  if (!parsed.ok) return parsed.state;
  const result = await runAction(async () => {
    const [file] = files(formData, "file");
    if (!file) throw invalid("Choose a file to upload.", { file: "Choose a PDF or image file." });
    await addManufacturerDocument(actor, file, parsed.data.type, parsed.data.certificationName);
    return "Document uploaded. It will be reviewed with your verification request.";
  });
  revalidatePath("/factory");
  return result;
}

export async function deleteDocumentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireUser(["MANUFACTURER"]);
  const result = await runAction(async () => {
    await deleteManufacturerDocument(actor, String(formData.get("documentId")));
    return "Document deleted.";
  });
  revalidatePath("/factory");
  return result;
}

export async function requestVerificationAction(): Promise<FormState> {
  const actor = await requireUser(["MANUFACTURER"]);
  const result = await runAction(async () => {
    await requestVerification(actor);
    return "Verification requested. An administrator will review your documents.";
  });
  revalidatePath("/factory");
  revalidatePath("/dashboard");
  return result;
}

export async function changePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireUser();
  const parsed = parseForm(changePasswordSchema, formObject(formData));
  if (!parsed.ok) return parsed.state;
  return runAction(async () => {
    await changePassword(actor, parsed.data.currentPassword, parsed.data.newPassword);
    return "Password changed.";
  });
}
