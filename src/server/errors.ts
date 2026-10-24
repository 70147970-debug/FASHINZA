/**
 * Domain errors thrown by services. Server actions and route handlers translate them into
 * user-facing messages; anything else is logged and reported as a generic failure.
 */
export class AppError extends Error {
  constructor(
    message: string,
    readonly code: "NOT_FOUND" | "FORBIDDEN" | "CONFLICT" | "INVALID" | "UNAUTHENTICATED",
    readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const notFound = (what = "Record") => new AppError(`${what} was not found or you do not have access to it.`, "NOT_FOUND");
export const forbidden = (message = "You do not have permission to do that.") => new AppError(message, "FORBIDDEN");
export const conflict = (message: string) => new AppError(message, "CONFLICT");
export const invalid = (message: string, fieldErrors?: Record<string, string>) => new AppError(message, "INVALID", fieldErrors);

export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}
