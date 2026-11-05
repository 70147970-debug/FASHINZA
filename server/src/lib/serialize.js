/**
 * Serialisation rules (docs/mern/api.md §1.8):
 * - every document has `id` (hex string) and no `_id` / `__v`; references are hex strings;
 * - Decimal128 fields are strings with the column's scale ("1234.50"), or null;
 * - dates stay Date objects (JSON.stringify turns them into ISO strings);
 * - Mixed (Json) fields pass through as stored.
 *
 * Hydrated documents get this through the schema's toJSON/toObject transform (toJSONPlugin). Lean results
 * go through serialize(Model, doc) or plain(value).
 */
import mongoose from "mongoose";
import Decimal from "decimal.js";

const { ObjectId, Decimal128 } = mongoose.Types;

/**
 * Formats a decimal value (Decimal128, decimal.js, string or number) with a fixed scale; null stays null.
 * @param {unknown} value
 * @param {number} [scale]
 * @returns {string | null}
 */
export function money(value, scale = 2) {
  if (value == null) return null;
  return new Decimal(String(value)).toFixed(scale);
}

/** decimal.js value from Decimal128 / string / number (null → null). Never use Number() for money. */
export function dec(value) {
  if (value == null) return null;
  return new Decimal(String(value));
}

/**
 * Decimal128 for storage at a fixed scale; null/undefined pass through; values that cannot be read are
 * returned unchanged so Mongoose reports its usual cast error.
 * @param {unknown} value
 * @param {number} scale
 */
export function toDecimal128(value, scale) {
  if (value == null) return value;
  let raw = value;
  if (typeof value === "object" && value !== null && "$numberDecimal" in value) raw = /** @type {any} */ (value).$numberDecimal;
  try {
    return Decimal128.fromString(new Decimal(String(raw)).toFixed(scale));
  } catch {
    return value;
  }
}

/** @param {import("mongoose").Schema} schema @returns {[string, number][]} */
function decimalPaths(schema) {
  if (!schema.$fzDecimalPaths) {
    /** @type {[string, number][]} */
    const paths = [];
    schema.eachPath((p, type) => {
      if (type.instance === "Decimal128") paths.push([p, type.options.scale ?? 2]);
    });
    schema.$fzDecimalPaths = paths;
  }
  return schema.$fzDecimalPaths;
}

/** Converts ObjectId / Decimal128 leaves to strings in place (one level, arrays included). */
function flattenLeaves(obj) {
  for (const [k, v] of Object.entries(obj)) {
    if (v instanceof ObjectId) obj[k] = v.toHexString();
    else if (v instanceof Decimal128) obj[k] = v.toString();
    else if (Array.isArray(v) && v.some((x) => x instanceof ObjectId)) obj[k] = v.map((x) => (x instanceof ObjectId ? x.toHexString() : x));
  }
}

/**
 * Applies the §1.8 rules to one plain object produced from `schema` (mutates and returns it).
 * @param {import("mongoose").Schema} schema
 * @param {Record<string, any>} ret
 */
export function transformRecord(schema, ret) {
  if (ret._id !== undefined) {
    ret.id = ret._id instanceof ObjectId ? ret._id.toHexString() : String(ret._id);
    delete ret._id;
  }
  delete ret.__v;
  for (const [p, scale] of decimalPaths(schema)) {
    if (p in ret) ret[p] = ret[p] == null ? null : money(ret[p], scale);
  }
  flattenLeaves(ret);
  return ret;
}

/** Schema plugin: toJSON/toObject give `id`, string refs and scaled decimal strings. */
export function toJSONPlugin(schema) {
  const transform = (_doc, ret) => transformRecord(schema, ret);
  schema.set("toJSON", { virtuals: false, versionKey: false, transform });
  schema.set("toObject", { virtuals: false, versionKey: false, transform });
}

/**
 * Serialises hydrated documents or lean objects of `Model` (or arrays of them). Nested relation objects
 * that the caller already attached are passed through `plain()`.
 * @param {import("mongoose").Model<any>} Model
 * @param {any} doc
 */
export function serialize(Model, doc) {
  if (doc == null) return null;
  if (Array.isArray(doc)) return doc.map((d) => serialize(Model, d));
  if (doc instanceof mongoose.Document) return plain(doc.toJSON());
  const copy = transformRecord(Model.schema, { ...doc });
  for (const [k, v] of Object.entries(copy)) {
    if (v && typeof v === "object" && !(v instanceof Date)) copy[k] = plain(v);
  }
  return copy;
}

/**
 * Generic deep conversion for anything left over: ObjectId → hex, Decimal128 → string (as stored),
 * `_id` → `id`, no `__v`. Dates and Mixed values are kept.
 * @param {any} value
 * @returns {any}
 */
export function plain(value) {
  if (value == null || typeof value !== "object") return value;
  if (value instanceof Date) return value;
  if (value instanceof ObjectId) return value.toHexString();
  if (value instanceof Decimal128) return value.toString();
  if (value instanceof Decimal) return value.toString();
  if (value instanceof mongoose.Document) return plain(value.toJSON());
  if (Array.isArray(value)) return value.map(plain);
  if (Buffer.isBuffer(value)) return value;
  /** @type {Record<string, any>} */
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (k === "__v") continue;
    if (k === "_id") out.id = plain(v);
    else out[k] = plain(v);
  }
  return out;
}

/** `page` query value → page number ≥ 1. */
export function pageNumber(value) {
  return Math.max(1, Number(value) || 1);
}

/**
 * Paginated list shape `{ items, total, page, pageSize, pages }`; pass `withPageSize: false` for the admin
 * lists that return `{ items, total, page, pages }`.
 */
export function page({ items, total, page: p, pageSize: size }, { withPageSize = true } = {}) {
  const pages = Math.max(1, Math.ceil(total / size));
  return withPageSize ? { items, total, page: p, pageSize: size, pages } : { items, total, page: p, pages };
}

/** Escapes user input for a case-insensitive substring RegExp (never pass raw input as a regex). */
export function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Prisma `contains` + `mode: "insensitive"` equivalent. */
export function containsInsensitive(q) {
  return new RegExp(escapeRegExp(q), "i");
}
