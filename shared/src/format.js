/** Formatting helpers. Dates are stored in UTC and shown in UTC so server and browser agree. */

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const dateTimeFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" });

/** @param {Date | string | null | undefined} d */
export function formatDate(d) {
  return d ? dateFmt.format(new Date(d)) : "—";
}

/** @param {Date | string | null | undefined} d */
export function formatDateTime(d) {
  return d ? `${dateTimeFmt.format(new Date(d))} UTC` : "—";
}

/** "3 days ago" / "in 5 days" relative to now. */
/** Calendar date `days` from now as YYYY-MM-DD (UTC), e.g. for a date input's `min` or default value. */
/** @param {number} days @param {Date} [now] */
export function isoDateInDays(days, now = new Date()) {
  return new Date(now.getTime() + days * 86400000).toISOString().slice(0, 10);
}

/** @param {Date | string} d @param {Date} [now] */
export function relativeDays(d, now = new Date()) {
  const days = Math.round((new Date(d).getTime() - now.getTime()) / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  return days > 0 ? `in ${days} days` : `${-days} days ago`;
}

/** @param {{ toString(): string } | number | string | null | undefined} amount @param {string} currency */
export function formatMoney(amount, currency) {
  if (amount === null || amount === undefined) return "—";
  const n = Number(amount.toString());
  return new Intl.NumberFormat("en-GB", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

/** @param {number | null | undefined} n */
export function formatNumber(n) {
  return n === null || n === undefined ? "—" : new Intl.NumberFormat("en-GB").format(n);
}

/** @param {number} bytes */
export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** @param {string} name */
export function initials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");
}
