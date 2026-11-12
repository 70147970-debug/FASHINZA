/**
 * MongoDB connection and transaction helper.
 *
 * MongoDB runs as a single-node replica set (rs0) so multi-document transactions work. Every Prisma
 * `$transaction` from the original services becomes `withTransaction(async (session) => …)` and every
 * query inside passes `{ session }`.
 */
import mongoose from "mongoose";
import { config, redactUri } from "./config.js";

mongoose.set("strictQuery", true);
// Fail fast instead of queueing queries while MongoDB is unreachable: the API answers 503 straight away
// (see isDatabaseUnavailable and the error middleware) rather than hanging for Mongoose's 10 s buffer timeout.
mongoose.set("bufferCommands", false);
// With buffering off, Mongoose's automatic createCollection/createIndexes would run as each model is
// compiled (before connecting), fail, and cache that failure for every later Model.init(). Collections and
// indexes are created explicitly by ensureCollections() once the connection is open instead.
mongoose.set("autoCreate", false);
mongoose.set("autoIndex", false);

/** Connects the default Mongoose connection (idempotent). */
export async function connectDb(uri = config.mongodbUri, options = {}) {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000, ...options });
  return mongoose.connection;
}

/**
 * Creates every collection and its indexes (unique rules included) and waits until they exist. Automatic
 * creation is switched off above, so this must run after connecting: before seeding a fresh database, and
 * before transactions write, since they cannot rely on creating collections implicitly.
 */
export async function ensureCollections() {
  const { ALL_MODELS } = await import("./models/index.js");
  for (const Model of ALL_MODELS) {
    await Model.createCollection(); // an existing collection is not an error
    await Model.createIndexes();
  }
}

export async function disconnectDb() {
  await mongoose.disconnect();
}

/** Throws unless the database answers a ping. Never waits for a connection to be established. */
export async function pingDb() {
  const conn = mongoose.connection;
  if (conn.readyState !== 1 || !conn.db) throw new Error("Database is not connected.");
  await conn.db.admin().ping();
}

export { redactUri };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** @param {unknown} e @param {string} label */
export function hasErrorLabel(e, label) {
  if (!e || typeof e !== "object") return false;
  const err = /** @type {any} */ (e);
  if (typeof err.hasErrorLabel === "function") return err.hasErrorLabel(label);
  return Array.isArray(err.errorLabels) && err.errorLabels.includes(label);
}

/** MongoDB duplicate-key error (replaces Prisma P2002). */
export function isDuplicateKeyError(e) {
  const err = /** @type {any} */ (e);
  return Boolean(err) && (err.code === 11000 || err.code === 11001 || err?.cause?.code === 11000);
}

const UNAVAILABLE_ERRORS = new Set([
  "MongooseServerSelectionError",
  "MongoServerSelectionError",
  "MongoNetworkError",
  "MongoNetworkTimeoutError",
  "MongoNotConnectedError",
  "MongoTopologyClosedError",
  "MongoPoolClearedError",
]);

/**
 * The database could not be reached (never connected, connection lost, server selection timed out). The
 * error middleware answers these with 503 instead of a generic 500.
 */
export function isDatabaseUnavailable(e) {
  for (let err = /** @type {any} */ (e), depth = 0; err && typeof err === "object" && depth < 4; err = err.cause, depth++) {
    if (UNAVAILABLE_ERRORS.has(err.name)) return true;
    if (err.name === "MongooseError" && /before initial connection is complete|buffering timed out|Connection was force closed|Client must be connected/i.test(String(err.message))) {
      return true;
    }
  }
  return false;
}

/** A transaction lost a write conflict with a concurrent transaction (code 112). */
export function isWriteConflict(e) {
  const err = /** @type {any} */ (e);
  return Boolean(err) && (err.code === 112 || err.codeName === "WriteConflict" || hasErrorLabel(e, "TransientTransactionError"));
}

/**
 * Runs `fn(session)` inside a MongoDB transaction and commits it.
 *
 * - Transient transaction errors (write conflicts, primary step-down) retry the whole function, at most
 *   `maxAttempts` times in total; when they persist the last error is thrown, so callers can translate
 *   it into their own conflict() message (see isWriteConflict).
 * - Commit results that are unknown are retried a few times as the driver recommends.
 * - Any other error (including AppError) aborts the transaction and is re-thrown unchanged.
 *
 * @template T
 * @param {(session: import("mongoose").ClientSession) => Promise<T>} fn
 * @param {{ maxAttempts?: number } & import("mongodb").TransactionOptions} [opts]
 * @returns {Promise<T>}
 */
export async function withTransaction(fn, opts = {}) {
  const { maxAttempts = 4, ...txOptions } = opts;
  for (let attempt = 1; ; attempt++) {
    const session = await mongoose.startSession();
    try {
      session.startTransaction({ readConcern: { level: "snapshot" }, writeConcern: { w: "majority" }, ...txOptions });
      const result = await fn(session);
      await commitWithRetry(session);
      return result;
    } catch (e) {
      if (session.inTransaction()) await session.abortTransaction().catch(() => {});
      if (attempt < maxAttempts && hasErrorLabel(e, "TransientTransactionError")) {
        await sleep(10 * attempt + Math.floor(Math.random() * 20));
        continue;
      }
      throw e;
    } finally {
      await session.endSession().catch(() => {});
    }
  }
}

async function commitWithRetry(session, attempts = 3) {
  for (let i = 1; ; i++) {
    try {
      await session.commitTransaction();
      return;
    } catch (e) {
      if (i < attempts && hasErrorLabel(e, "UnknownTransactionCommitResult")) continue;
      throw e;
    }
  }
}
