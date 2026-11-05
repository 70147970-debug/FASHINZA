/**
 * Page-data helpers for the ports of the Next.js server components (CLIENT-B pages).
 *
 * The server components received Prisma objects: dates were `Date` instances and decimals were `Decimal`
 * objects. The JSON API sends ISO strings for both (docs/mern/api.md §1.8). `loadData` revives the date
 * strings into `Date` objects so the ported markup can compare and format them exactly as before; decimals
 * stay strings (`formatMoney` and `Number()` accept them) and `decimalText` reproduces `Decimal#toString()`.
 */
import Decimal from "decimal.js";
import { loadJson } from "./api";

/** `2026-11-05T10:00:00.000Z` — the only shape `Date#toJSON()` produces. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

/** Json columns are passed through as stored (§1.8); their contents are left untouched, as with Prisma. */
const RAW_JSON_KEYS = new Set(["breakdown", "agreedTerms", "metadata", "changes", "payload", "snapshot", "summary"]);

/**
 * Returns a copy of `value` with every ISO date string turned into a `Date`, except inside Json columns.
 * @template T
 * @param {T} value
 * @returns {T}
 */
export function reviveDates(value) {
  if (typeof value === "string") return ISO_DATE.test(value) ? new Date(value) : value;
  if (Array.isArray(value)) return value.map((v) => reviveDates(v));
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = RAW_JSON_KEYS.has(k) ? v : reviveDates(v);
    return out;
  }
  return value;
}

/**
 * `loadJson` (gate redirects, NOT_FOUND → not-found card) followed by `reviveDates`.
 * @param {string} path
 * @param {{ request?: Request, query?: Record<string, unknown> }} [options]
 */
export async function loadData(path, options) {
  return reviveDates(await loadJson(path, options));
}

/** `Decimal#toString()` of a serialised decimal ("30.00" → "30", "2.50" → "2.5"); null/undefined pass through. */
export function decimalText(value) {
  if (value === null || value === undefined || value === "") return value;
  return new Decimal(value).toString();
}

/** `Decimal#toFixed(n)` of a serialised decimal. */
export function decimalFixed(value, digits = 2) {
  return new Decimal(value).toFixed(digits);
}

/** Search params of a loader request as a plain object (last value wins, like Next's `searchParams`). */
export function searchOf(request) {
  return Object.fromEntries(new URL(request.url).searchParams);
}
