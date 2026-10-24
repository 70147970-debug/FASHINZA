import "server-only";
import { unstable_rethrow } from "next/navigation";
import type { z, ZodTypeAny } from "zod";
import { type FormState, zodFieldErrors } from "@/lib/form-state";
import { isAppError } from "./errors";

/**
 * Runs a server action body and converts failures into a FormState.
 * Domain errors (AppError) become user-facing messages with field errors; anything unexpected
 * is logged on the server and reported with a generic message that reveals no internals.
 * Next.js redirect/notFound signals are re-thrown untouched.
 */
export async function runAction(fn: () => Promise<FormState | string | void>): Promise<FormState> {
  try {
    const raw = await fn();
    const result: FormState = typeof raw === "string" ? { status: "success", message: raw } : (raw ?? { status: "success", message: "Saved." });
    return result;
  } catch (e) {
    unstable_rethrow(e);
    if (isAppError(e)) return { status: "error", message: e.message, fieldErrors: e.fieldErrors };
    console.error("[action] unexpected error", e);
    return { status: "error", message: "Something went wrong on our side. Your changes were not saved — please try again." };
  }
}

/** Parses FormData with a Zod schema, returning either the data or a FormState with field errors. */
export function parseForm<S extends ZodTypeAny>(schema: S, data: unknown): { ok: true; data: z.output<S> } | { ok: false; state: FormState } {
  const parsed = schema.safeParse(data);
  if (parsed.success) return { ok: true, data: parsed.data };
  return { ok: false, state: { status: "error", message: "Please correct the highlighted fields.", fieldErrors: zodFieldErrors(parsed.error) } };
}

/** FormData → plain object, with the given keys read as arrays (checkbox groups, multi-selects). */
export function formObject(formData: FormData, arrayKeys: readonly string[] = []) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of formData.entries()) {
    if (k.startsWith("$ACTION")) continue;
    if (!arrayKeys.includes(k) && typeof v === "string") out[k] = v;
  }
  for (const k of arrayKeys) out[k] = formData.getAll(k).filter((v): v is string => typeof v === "string" && v.trim() !== "");
  return out;
}

export function files(formData: FormData, key: string) {
  return formData.getAll(key).filter((f): f is File => f instanceof File && f.size > 0);
}
