"use server";

import { loginSchema, registerSchema } from "@/lib/validation/auth";
import { type FormState, zodFieldErrors } from "@/lib/form-state";

// Stage 2: inputs are validated on the server. Account creation and sign-in are connected in Stage 3.
const NOT_YET = "Account sign-in is being connected in the next build stage. Your input passed validation.";

export async function registerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: "Please correct the highlighted fields.", fieldErrors: zodFieldErrors(parsed.error) };
  return { status: "error", message: NOT_YET };
}

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: "Please correct the highlighted fields.", fieldErrors: zodFieldErrors(parsed.error) };
  return { status: "error", message: NOT_YET };
}
