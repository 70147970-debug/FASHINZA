/**
 * Query and shaping helpers used by the SERVER-A services (projects, quotations, opportunities, matching,
 * profiles, files). They reproduce the parts of Prisma's behaviour that MongoDB does not give for free:
 * relation includes, PostgreSQL enum and NULL ordering, Decimal.toString(), and "malformed id = not found".
 */
import Decimal from "decimal.js";
import mongoose from "mongoose";
import { AttachmentKind, enumRank } from "@fashinza/shared/enums.js";
import { toObjectId } from "./ids.js";
import { toDecimal128 } from "./serialize.js";

export { toObjectId };

/**
 * ObjectId for a path/body id. A malformed id becomes a fresh ObjectId that matches nothing, so the
 * query simply finds no record and the service reports its own notFound(...) message (never a CastError).
 * @param {unknown} id
 */
export function oid(id) {
  return toObjectId(id) ?? new mongoose.Types.ObjectId("000000000000000000000000");
}

/** `.session()` argument (null outside a transaction). */
export const s = (session) => session ?? null;

/** Write options with the transaction session when there is one. */
export const opts = (session, extra = {}) => (session ? { session, ...extra } : { ...extra });

/**
 * Combines Mongo filters like Prisma's `AND: [...]` (empty filters are dropped, keys never overwrite each other).
 * @param {...Record<string, unknown>} filters
 */
export function and(...filters) {
  const parts = filters.filter((f) => f && Object.keys(f).length);
  if (!parts.length) return {};
  if (parts.length === 1) return parts[0];
  return { $and: parts };
}

/** Decimal128 at a column scale for update operators (creates go through the schema setter). */
export const d128 = (value, scale = 2) => (value == null ? null : toDecimal128(String(value), scale));

/** Prisma's `String(decimal)` / `decimal.toString()` (e.g. Decimal128 "120.00" → "120", "3320.50" → "3320.5"). */
export function decimalString(value) {
  if (value == null) return null;
  return new Decimal(String(value)).toString();
}

/** Compares two decimal values (Decimal128 / string / number) numerically. */
export function compareDecimal(a, b) {
  return new Decimal(String(a ?? 0)).comparedTo(new Decimal(String(b ?? 0)));
}

/** Map of documents by a key (hex string). */
export function byId(list, key = "_id") {
  const map = new Map();
  for (const item of list) map.set(String(item[key]), item);
  return map;
}

/** Groups documents by a key (hex string). */
export function groupBy(list, key) {
  const map = new Map();
  for (const item of list) {
    const k = String(item[key]);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(item);
  }
  return map;
}

const time = (d) => (d instanceof Date ? d.getTime() : d ? new Date(d).getTime() : 0);

/**
 * Attachment order of the original queries: kind asc (enum declaration order, as in PostgreSQL), version desc
 * with NULLs first (PostgreSQL DESC default), then createdAt desc.
 * @param {Array<{ kind: string, version?: number | null, createdAt?: Date }>} list
 * @param {{ createdAt?: boolean }} [o] whether createdAt desc is part of the order (getProject: yes)
 */
export function sortAttachments(list, o = { createdAt: true }) {
  return [...list].sort((a, b) => {
    const k = enumRank(AttachmentKind, a.kind) - enumRank(AttachmentKind, b.kind);
    if (k) return k;
    const av = a.version ?? null;
    const bv = b.version ?? null;
    if (av !== bv) {
      if (av === null) return -1;
      if (bv === null) return 1;
      return bv - av;
    }
    if (o.createdAt) {
      const t = time(b.createdAt) - time(a.createdAt);
      if (t) return t;
    }
    return String(a._id ?? a.id).localeCompare(String(b._id ?? b.id));
  });
}

/** Removes keys whose value is undefined (Prisma ignores undefined in `data`, it does not clear the column). */
export function defined(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}
