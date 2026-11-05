import { describe, expect, it } from "vitest";
import { burnPasswordCheck, hashPassword, newToken, SCRYPT, sha256, verifyPassword } from "../../src/auth/password.js";

// Produced by the original src/server/auth/password.ts (PostgreSQL app) — existing users must still sign in.
const ORIGINAL_HASH = "scrypt$131072$8$1$3xi4breDXAPG9cFElA56rg==$e2xYhyzzN2PqT00WPBVYySwyG1WBlrU68blN6CO7Xd/dFCe3dW9mtQ8w3OgkXoQ6SmArr4xrRz2KUqnvL+USYw==";
// Original hash of "Ｐａｓｓword123 café" (full-width letters), stored after NFKC normalisation.
const ORIGINAL_NFKC_HASH = "scrypt$131072$8$1$rXXHV6rmbdLv0LAz72VYEg==$zXDo3Z244HYcArQhKkmMTM9+FwsJkVVTJg381f+G+t/la8QlSrNRtMH9F84P6A8KQOtkT87Qvk509k7BZxCZCw==";

describe("password hashing", () => {
  it("uses the original scrypt parameters and storage format", async () => {
    expect(SCRYPT).toMatchObject({ N: 131072, r: 8, p: 1, keylen: 64 });
    const hash = await hashPassword("Password123");
    const parts = hash.split("$");
    expect(parts.slice(0, 4)).toEqual(["scrypt", "131072", "8", "1"]);
    expect(Buffer.from(parts[4], "base64")).toHaveLength(16);
    expect(Buffer.from(parts[5], "base64")).toHaveLength(64);
    expect(hash).not.toContain("Password123");
  });

  it("verifies its own hashes and rejects wrong passwords", async () => {
    const hash = await hashPassword("Password123");
    expect(await verifyPassword("Password123", hash)).toBe(true);
    expect(await verifyPassword("Password124", hash)).toBe(false);
    expect(await hashPassword("Password123")).not.toBe(hash); // random salt
  });

  it("accepts hashes written by the original Next.js app", async () => {
    expect(await verifyPassword("Password123", ORIGINAL_HASH)).toBe(true);
    expect(await verifyPassword("password123", ORIGINAL_HASH)).toBe(false);
  });

  it("normalises passwords with NFKC before hashing", async () => {
    expect(await verifyPassword("Password123 café", ORIGINAL_NFKC_HASH)).toBe(true);
    expect(await verifyPassword("Ｐａｓｓword123 café", ORIGINAL_NFKC_HASH)).toBe(true);
  });

  it("rejects malformed stored values without throwing", async () => {
    expect(await verifyPassword("x", "")).toBe(false);
    expect(await verifyPassword("x", "bcrypt$abc")).toBe(false);
    expect(await verifyPassword("x", null)).toBe(false);
  });

  it("burnPasswordCheck completes for unknown accounts", async () => {
    await expect(burnPasswordCheck("whatever-password")).resolves.toBeUndefined();
  });
});

describe("tokens", () => {
  it("creates 32-byte base64url session tokens", () => {
    const a = newToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(newToken()).not.toBe(a);
  });

  it("hashes tokens with SHA-256 hex (same as the original)", () => {
    expect(sha256("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});
