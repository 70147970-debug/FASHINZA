import { beforeEach, describe, expect, it } from "vitest";
import { rateLimit, resetRateLimits } from "@/lib/rate-limit";

describe("rateLimit", () => {
  beforeEach(() => resetRateLimits());

  it("allows up to the limit, then blocks within the window", () => {
    const t = 1_000_000;
    for (let i = 0; i < 3; i++) expect(rateLimit("k", 3, 60_000, t).ok).toBe(true);
    const blocked = rateLimit("k", 3, 60_000, t + 10);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterMs).toBe(59_990);
  });

  it("resets after the window and keeps keys separate", () => {
    const t = 1_000_000;
    for (let i = 0; i < 3; i++) rateLimit("a", 3, 1000, t);
    expect(rateLimit("b", 3, 1000, t).ok).toBe(true);
    expect(rateLimit("a", 3, 1000, t + 1001).ok).toBe(true);
  });
});
