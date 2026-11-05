import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import { E2E_ENV, E2E_MONGODB_URI, databaseName } from "./env.js";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * Prepares the disposable e2e database before Playwright starts the server: drops the whole database, then
 * re-seeds it (administrator + demo organisations) with server/scripts/seed.js. Refuses to run unless the
 * database name contains "e2e".
 */
async function prepare() {
  const name = databaseName(E2E_MONGODB_URI);
  if (!/e2e/i.test(name)) throw new Error("Set E2E_MONGODB_URI to a disposable MongoDB database whose name contains 'e2e'.");
  rmSync(E2E_ENV.UPLOAD_DIR, { recursive: true, force: true });

  const conn = await mongoose.createConnection(E2E_MONGODB_URI, { serverSelectionTimeoutMS: 10_000 }).asPromise();
  try {
    // Double-check the database the driver actually opened before dropping it.
    if (!/e2e/i.test(conn.db.databaseName)) throw new Error(`Refusing to drop "${conn.db.databaseName}": its name does not contain "e2e".`);
    await conn.dropDatabase();
  } finally {
    await conn.close();
  }

  execFileSync(process.execPath, [path.join(REPO_ROOT, "server", "scripts", "seed.js")], {
    cwd: REPO_ROOT,
    stdio: "pipe",
    env: { ...process.env, ...E2E_ENV, NODE_ENV: "production" },
  });
}

await prepare();
console.log("e2e database dropped and seeded");
