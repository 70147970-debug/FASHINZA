/**
 * ObjectId helpers. A malformed id in a path must behave exactly like an unknown id (the service's own
 * notFound message), never a 500 / CastError.
 */
import mongoose from "mongoose";

const HEX24 = /^[a-f0-9]{24}$/i;

/** @param {unknown} id */
export function isObjectId(id) {
  if (id instanceof mongoose.Types.ObjectId) return true;
  return typeof id === "string" && HEX24.test(id);
}

/**
 * Converts a hex string (or ObjectId) into an ObjectId, or null when malformed.
 * @param {unknown} id
 */
export function toObjectId(id) {
  if (id instanceof mongoose.Types.ObjectId) return id;
  return isObjectId(id) ? new mongoose.Types.ObjectId(/** @type {string} */ (id)) : null;
}

/** Hex string of an ObjectId / populated doc / string, or null. */
export function idOf(value) {
  if (value == null) return null;
  if (typeof value === "string") return value;
  if (value instanceof mongoose.Types.ObjectId) return value.toHexString();
  if (typeof value === "object" && "_id" in value) return idOf(value._id);
  if (typeof value === "object" && "id" in value && typeof value.id === "string") return value.id;
  return String(value);
}

/** Compares two ids of any supported form. */
export function sameId(a, b) {
  const x = idOf(a);
  return x !== null && x === idOf(b);
}
