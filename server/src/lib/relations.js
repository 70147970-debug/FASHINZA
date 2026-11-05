/**
 * Helpers for rebuilding Prisma `include` / `select` trees from separate MongoDB collections
 * (docs/mern/api.md §1.8: relations keep exactly the nesting and key names of the original queries).
 *
 * Every helper takes an optional transaction `session`. Results are lean documents; serialise them with
 * `serialize(Model, doc)` from ./serialize.js once the relations are attached.
 */
import { enumRank } from "@fashinza/shared/enums.js";
import { idOf, toObjectId } from "./ids.js";

/** Unique ObjectIds of a list of ids (hex strings or ObjectIds); malformed values are dropped. */
export function objectIds(values) {
  const seen = new Map();
  for (const v of values) {
    const oid = toObjectId(v);
    if (oid) seen.set(oid.toHexString(), oid);
  }
  return [...seen.values()];
}

/**
 * Loads documents by id into a Map keyed by hex id.
 * @param {import("mongoose").Model<any>} Model
 * @param {unknown[]} ids
 * @param {Record<string, 0 | 1> | null} [projection]
 * @param {import("mongoose").ClientSession | null} [session]
 * @returns {Promise<Map<string, any>>}
 */
export async function mapById(Model, ids, projection = null, session = null) {
  const list = objectIds(ids);
  if (!list.length) return new Map();
  const docs = await Model.find({ _id: { $in: list } }, projection).session(session ?? null).lean();
  return new Map(docs.map((d) => [d._id.toHexString(), d]));
}

/**
 * Loads documents whose `field` is one of `ids`, grouped by that field (hex id → array).
 * @param {import("mongoose").Model<any>} Model
 * @param {string} field
 * @param {unknown[]} ids
 * @param {{ projection?: Record<string, 0 | 1> | null, sort?: Record<string, 1 | -1>, filter?: Record<string, unknown>, session?: import("mongoose").ClientSession | null }} [o]
 * @returns {Promise<Map<string, any[]>>}
 */
export async function groupByRef(Model, field, ids, o = {}) {
  const list = objectIds(ids);
  /** @type {Map<string, any[]>} */
  const out = new Map(list.map((id) => [id.toHexString(), []]));
  if (!list.length) return out;
  let query = Model.find({ ...(o.filter ?? {}), [field]: { $in: list } }, o.projection ?? null).session(o.session ?? null);
  if (o.sort) query = query.sort(o.sort);
  const docs = await query.lean();
  for (const d of docs) {
    const key = idOf(d[field]);
    if (!out.has(key)) out.set(key, []);
    out.get(key).push(d);
  }
  return out;
}

/** One document per `field` value (to-one relation on the child side, e.g. User → BrandProfile). */
export async function oneByRef(Model, field, ids, projection = null, session = null) {
  const grouped = await groupByRef(Model, field, ids, { projection, session });
  /** @type {Map<string, any>} */
  const out = new Map();
  for (const [k, v] of grouped) if (v.length) out.set(k, v[0]);
  return out;
}

/**
 * Comparator for in-memory sorts that reproduce PostgreSQL ordering.
 * - `dir`: "asc" | "desc";
 * - `nulls`: "first" | "last" (default: PostgreSQL's — NULLS LAST for ASC, NULLS FIRST for DESC);
 * - `enumValues`: sort an enum column by declaration order (PostgreSQL enum sort).
 * @param {(doc: any) => unknown} get
 * @param {{ dir?: "asc" | "desc", nulls?: "first" | "last", enumValues?: readonly string[] }} [o]
 */
export function by(get, o = {}) {
  const dir = o.dir ?? "asc";
  const nulls = o.nulls ?? (dir === "asc" ? "last" : "first");
  const sign = dir === "asc" ? 1 : -1;
  return (a, b) => {
    let x = get(a);
    let y = get(b);
    const xn = x == null;
    const yn = y == null;
    if (xn || yn) {
      if (xn && yn) return 0;
      return (xn ? -1 : 1) * (nulls === "first" ? 1 : -1);
    }
    if (o.enumValues) {
      x = enumRank(o.enumValues, String(x));
      y = enumRank(o.enumValues, String(y));
    } else if (x instanceof Date || y instanceof Date) {
      x = new Date(/** @type {any} */ (x)).getTime();
      y = new Date(/** @type {any} */ (y)).getTime();
    } else if (typeof x === "object" || typeof y === "object") {
      x = idOf(x);
      y = idOf(y);
    }
    if (x < y) return -sign;
    if (x > y) return sign;
    return 0;
  };
}

/** Combines comparators (first non-zero wins). */
export function sortWith(list, ...comparators) {
  return [...list].sort((a, b) => {
    for (const c of comparators) {
      const r = c(a, b);
      if (r) return r;
    }
    return 0;
  });
}

/**
 * Aggregation stages that sort like PostgreSQL with explicit null placement, e.g.
 * `nullAwareSort([["dueAt", 1, "last"], ["_id", 1]])`. Adds and later removes helper fields.
 * @param {[string, 1 | -1, ("first" | "last")?][]} keys
 */
export function nullAwareSort(keys) {
  /** @type {Record<string, unknown>} */
  const add = {};
  /** @type {Record<string, 1 | -1>} */
  const sort = {};
  const helpers = [];
  keys.forEach(([field, dir, nulls], i) => {
    const placement = nulls ?? (dir === 1 ? "last" : "first");
    const h = `__null${i}`;
    helpers.push(h);
    // 1 = null. Nulls first → sort the helper descending; nulls last → ascending.
    add[h] = { $cond: [{ $eq: [{ $ifNull: [`$${field}`, null] }, null] }, 1, 0] };
    sort[h] = placement === "first" ? -1 : 1;
    sort[field] = dir;
  });
  return { addFields: { $addFields: add }, sort: { $sort: sort }, unset: { $unset: helpers } };
}

/** `{ name }` of a user (Prisma `select: { name: true }`), or null. */
export const pickName = (u) => (u ? { name: u.name } : null);
