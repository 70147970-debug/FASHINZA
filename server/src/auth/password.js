/**
 * Password hashing (port of src/server/auth/password.ts). Hashes written by the original PostgreSQL app
 * stay valid: same algorithm, parameters, NFKC normalisation and storage format.
 */
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = /** @type {(pw: string, salt: Buffer, keylen: number, opts: import("node:crypto").ScryptOptions) => Promise<Buffer>} */ (
  promisify(scryptCb)
);

// scrypt parameters (OWASP minimum: N=2^17, r=8, p=1).
export const SCRYPT = Object.freeze({ N: 2 ** 17, r: 8, p: 1, keylen: 64, maxmem: 256 * 1024 * 1024 });

/** Format: scrypt$N$r$p$saltB64$hashB64 */
export async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scrypt(password.normalize("NFKC"), salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p, maxmem: SCRYPT.maxmem });
  return ["scrypt", SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString("base64"), hash.toString("base64")].join("$");
}

export async function verifyPassword(password, stored) {
  const [alg, n, r, p, saltB64, hashB64] = String(stored ?? "").split("$");
  if (alg !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64");
  const actual = await scrypt(password.normalize("NFKC"), Buffer.from(saltB64, "base64"), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: SCRYPT.maxmem,
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Used when an email is unknown so that response timing does not reveal which accounts exist. */
let dummyHash;
export async function burnPasswordCheck(password) {
  dummyHash ??= hashPassword("timing-equaliser-not-a-real-password");
  await verifyPassword(password, await dummyHash);
}

export function newToken() {
  return randomBytes(32).toString("base64url");
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}
