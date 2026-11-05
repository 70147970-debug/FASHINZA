/**
 * Test database helpers: connect (guarded), build indexes once, wipe all collections between tests.
 */
import mongoose from "mongoose";
import { connectDb, disconnectDb } from "../../src/db.js";
import { ALL_MODELS } from "../../src/models/index.js";
import { assertTestDatabaseUri, DEFAULT_TEST_MONGODB_URI } from "./guard.js";

let indexesSynced = false;

export function testDatabaseUri() {
  return process.env.TEST_MONGODB_URI || DEFAULT_TEST_MONGODB_URI;
}

/** Connects to the test database (refuses any database whose name lacks "test") and syncs indexes once. */
export async function connectTestDb() {
  const uri = testDatabaseUri();
  assertTestDatabaseUri(uri);
  await connectDb(uri, { serverSelectionTimeoutMS: 3000 });
  const name = mongoose.connection.db?.databaseName ?? "";
  if (!/test/i.test(name)) throw new Error(`Refusing to run against database "${name}".`);
  if (!indexesSynced) {
    for (const Model of ALL_MODELS) {
      await Model.createCollection().catch(() => {});
      await Model.syncIndexes();
    }
    indexesSynced = true;
  }
}

/**
 * Removes every document from every collection (the Postgres TRUNCATE … CASCADE equivalent).
 * Collections and their indexes are kept so unique constraints stay in force.
 */
export async function resetDb() {
  const name = mongoose.connection.db?.databaseName ?? "";
  if (!/test/i.test(name)) throw new Error(`Refusing to wipe database "${name}".`);
  await Promise.all(ALL_MODELS.map((Model) => Model.deleteMany({})));
}

export async function disconnectTestDb() {
  await disconnectDb();
}
