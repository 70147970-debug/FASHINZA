/**
 * Domain errors thrown by services (port of src/server/errors.ts). The error middleware turns them into
 * `{ error: { code, message, fieldErrors? } }` with the HTTP status from STATUS; anything else is logged and
 * reported as a generic failure that reveals no internals.
 */

/** HTTP status per error code (docs/mern/api.md §1.4). */
export const STATUS = Object.freeze({
  INVALID: 400,
  UNAUTHENTICATED: 401,
  ROLE_DENIED: 403,
  PROFILE_INCOMPLETE: 403,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  RATE_LIMITED: 429,
  INTERNAL: 500,
  DATABASE_UNAVAILABLE: 503,
});

export class AppError extends Error {
  /**
   * @param {string} message user-facing message
   * @param {keyof typeof STATUS} code
   * @param {Record<string, string>} [fieldErrors]
   */
  constructor(message, code, fieldErrors) {
    super(message);
    this.name = "AppError";
    this.code = code;
    if (fieldErrors) this.fieldErrors = fieldErrors;
  }

  get status() {
    return STATUS[this.code] ?? 500;
  }
}

export const notFound = (what = "Record") => new AppError(`${what} was not found or you do not have access to it.`, "NOT_FOUND");
export const forbidden = (message = "You do not have permission to do that.") => new AppError(message, "FORBIDDEN");
export const conflict = (message) => new AppError(message, "CONFLICT");
export const invalid = (message, fieldErrors) => new AppError(message, "INVALID", fieldErrors);

// HTTP-layer errors (today these were redirects or route-handler responses).
export const unauthenticated = () => new AppError("Sign in to continue.", "UNAUTHENTICATED");
export const roleDenied = () => new AppError("That page is not available for your account type.", "ROLE_DENIED");
export const profileIncomplete = () => new AppError("Complete your profile to continue.", "PROFILE_INCOMPLETE");
export const rateLimited = (message) => new AppError(message, "RATE_LIMITED");
export const payloadTooLarge = () => new AppError("Payload too large.", "PAYLOAD_TOO_LARGE");

/** @param {unknown} e @returns {e is AppError} */
export function isAppError(e) {
  return e instanceof AppError;
}

/** Generic messages for unexpected failures (never leak internals). */
export const INTERNAL_MESSAGES = Object.freeze({
  /** today's runAction (server actions → mutations) */
  mutation: "Something went wrong on our side. Your changes were not saved — please try again.",
  /** today's errorResponse (GET pages, upload route, file download) */
  route: "Something went wrong. Please try again.",
});
