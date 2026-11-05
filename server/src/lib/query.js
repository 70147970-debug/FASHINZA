/**
 * Query-string readers for page-data endpoints (the equivalent of a page's `searchParams`).
 */

/**
 * One query value as a string (first value when the key repeats), or undefined.
 * @param {import("express").Request} req
 * @param {string} key
 * @returns {string | undefined}
 */
export function queryString(req, key) {
  const v = req.query?.[key];
  if (Array.isArray(v)) return typeof v[0] === "string" ? v[0] : undefined;
  return typeof v === "string" ? v : undefined;
}

/**
 * The value when it is one of `values` (an enum), else undefined — today's `sp.status in LABELS` checks.
 * @param {readonly string[]} values
 * @param {string | undefined} v
 */
export function oneOf(values, v) {
  return v && values.includes(v) ? v : undefined;
}

/** `Number(sp.page) || 1`. */
export function pageParam(req) {
  return Number(queryString(req, "page")) || 1;
}

/** Optional positive page size (`pageSize` query), else undefined so the service default applies. */
export function pageSizeParam(req) {
  const n = Number(queryString(req, "pageSize"));
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined;
}
