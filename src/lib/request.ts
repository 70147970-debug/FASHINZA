import "server-only";
import { headers } from "next/headers";

/** Best-effort client IP for rate limiting (behind a proxy, x-forwarded-for is set by the platform). */
export async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}
