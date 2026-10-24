import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Liveness/readiness probe for hosting platforms: reports whether the database answers. */
export async function GET() {
  const started = Date.now();
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", database: "ok", latencyMs: Date.now() - started, time: new Date().toISOString() });
  } catch (e) {
    console.error("[health] database check failed", e);
    return NextResponse.json({ status: "error", database: "unreachable" }, { status: 503 });
  }
}
