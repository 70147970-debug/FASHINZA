"use server";

import { db } from "@/lib/db";
import { contactSchema } from "@/lib/validation/contact";
import { type FormState, zodFieldErrors } from "@/lib/form-state";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";

export async function submitContact(_prev: FormState, formData: FormData): Promise<FormState> {
  const limit = rateLimit(`contact:${await clientIp()}`, 5, 10 * 60 * 1000);
  if (!limit.ok) {
    return { status: "error", message: "Too many messages from your connection. Please try again in a few minutes." };
  }

  const parsed = contactSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { status: "error", message: "Please correct the highlighted fields.", fieldErrors: zodFieldErrors(parsed.error) };
  }

  try {
    await db.contactInquiry.create({ data: parsed.data });
  } catch (err) {
    console.error("contact inquiry save failed", err);
    return { status: "error", message: "We could not send your message right now. Please try again later." };
  }
  return { status: "success", message: "Thank you — your message has been received. We usually reply within two working days." };
}
