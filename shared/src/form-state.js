/**
 * @typedef {object} FormState
 * @property {"idle" | "success" | "error"} status
 * @property {string} [message]
 * @property {Record<string, string>} [fieldErrors]
 * @property {string} [redirectTo] Where ActionForm should navigate after success (used instead of redirect() in form actions).
 */

/** @type {FormState} */
export const initialFormState = { status: "idle" };

/** @param {import("zod").ZodError} error @returns {Record<string, string>} */
export function zodFieldErrors(error) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}
