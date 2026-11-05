/**
 * Schema building blocks shared by every model (docs/mern/api.md §4):
 * - `_id` ObjectId exposed as `id`, no version key, toJSON/toObject per §1.8;
 * - optional fields default to null, Prisma defaults reproduced;
 * - Decimal columns are Decimal128 normalised to the column's scale on write;
 * - collection name = the Prisma @@map name.
 */
import mongoose from "mongoose";
import { toDecimal128, toJSONPlugin } from "../lib/serialize.js";

const { Schema } = mongoose;

// Prisma `String` columns accept "" (e.g. a new brand profile has country ""); Mongoose's default
// required-check for strings rejects "", so only null/undefined count as missing.
mongoose.Schema.Types.String.checkRequired((v) => typeof v === "string");

export { Schema };
export const ObjectIdType = Schema.Types.ObjectId;

/** Required reference. */
export const ref = (model) => ({ type: ObjectIdType, ref: model, required: true });
/** Optional reference (default null). */
export const optRef = (model) => ({ type: ObjectIdType, ref: model, default: null });

export const str = () => ({ type: String, required: true });
export const optStr = () => ({ type: String, default: null });
export const int = (def) => (def === undefined ? { type: Number, required: true, validate: Number.isInteger } : { type: Number, default: def, validate: Number.isInteger });
export const optInt = (def = null) => ({ type: Number, default: def, validate: (v) => v == null || Number.isInteger(v) });
export const bool = (def) => ({ type: Boolean, default: def });
export const date = () => ({ type: Date, required: true });
export const optDate = () => ({ type: Date, default: null });
export const mixed = () => ({ type: Schema.Types.Mixed, required: true });
export const optMixed = () => ({ type: Schema.Types.Mixed, default: null });
export const strArray = () => ({ type: [String], default: [] });

/**
 * Enum column (values in declaration order from @fashinza/shared/enums.js).
 * @param {readonly string[]} values
 * @param {string} [def] Prisma default
 */
export const enumOf = (values, def) => (def === undefined ? { type: String, enum: values, required: true } : { type: String, enum: values, default: def });

/**
 * Decimal column with a fixed scale (`@db.Decimal(p, scale)`).
 * @param {number} scale
 * @param {{ required?: boolean, default?: string | number | null }} [o]
 */
export function decimal(scale, o = {}) {
  /** @type {Record<string, unknown>} */
  const def = { type: Schema.Types.Decimal128, scale, set: (v) => toDecimal128(v, scale) };
  if (o.default !== undefined) def.default = o.default === null ? null : () => toDecimal128(String(o.default), scale);
  else if (o.required) def.required = true;
  else def.default = null;
  return def;
}

/**
 * @param {Record<string, unknown>} definition
 * @param {{ collection: string, timestamps?: boolean | { createdAt: boolean, updatedAt: boolean } }} opts
 */
export function makeSchema(definition, { collection, timestamps = false }) {
  const schema = new Schema(definition, { collection, timestamps, versionKey: false, strict: true });
  schema.plugin(toJSONPlugin);
  return schema;
}

export const CREATED_ONLY = { createdAt: true, updatedAt: false };
export const UPDATED_ONLY = { createdAt: false, updatedAt: true };
export const BOTH = true;

/** Compiles the model once (safe under test re-imports / watch mode). */
export function model(name, schema) {
  return mongoose.models[name] ?? mongoose.model(name, schema);
}
