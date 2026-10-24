"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "@/lib/form-state";
import { quotationSchema } from "@/lib/validation/quotation";
import { formObject, parseForm, runAction } from "@/server/action";
import { requireOnboardedUser } from "@/server/auth/session";
import { saveQuotation, withdrawQuotation } from "@/server/services/quotations";

export async function saveQuotationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireOnboardedUser(["MANUFACTURER"]);
  const projectId = String(formData.get("projectId"));
  const submit = formData.get("intent") === "submit";
  const parsed = parseForm(quotationSchema, formObject(formData));
  if (!parsed.ok) return parsed.state;
  const result = await runAction(async () => {
    const q = await saveQuotation(actor, projectId, parsed.data, submit);
    return submit ? `Quotation version ${q.version} sent to the brand.` : "Draft saved. The brand cannot see it until you send it.";
  });
  revalidatePath(`/opportunities/${projectId}`);
  revalidatePath("/quotations");
  return result;
}

export async function withdrawQuotationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireOnboardedUser(["MANUFACTURER"]);
  const result = await runAction(async () => {
    await withdrawQuotation(actor, String(formData.get("quotationId")));
    return "Quotation withdrawn.";
  });
  revalidatePath(`/opportunities/${formData.get("projectId")}`);
  revalidatePath("/quotations");
  return result;
}
