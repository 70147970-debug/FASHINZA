import "server-only";
import { NextResponse } from "next/server";
import { isAppError } from "./errors";

const STATUS = { NOT_FOUND: 404, FORBIDDEN: 403, CONFLICT: 409, INVALID: 400, UNAUTHENTICATED: 401 } as const;

/** Converts a thrown error into a JSON API response without leaking internals. */
export function errorResponse(e: unknown) {
  if (isAppError(e)) return NextResponse.json({ error: e.message, fieldErrors: e.fieldErrors }, { status: STATUS[e.code] });
  console.error("[api] unexpected error", e);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}

export const unauthenticated = () => NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
