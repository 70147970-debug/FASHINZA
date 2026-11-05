import { GARMENT_CATEGORIES } from "./constants.js";
import { formatDate, formatMoney, formatNumber } from "./format.js";

/**
 * Status tones, one mapping used everywhere (see docs/design-system.md#status):
 *  neutral  not started, draft, closed, withdrawn
 *  info     moving normally: in progress, in production, in transit
 *  accent   open in the marketplace, waiting for factories (submitted, receiving quotes) — the forest-green
 *           accent is used sparingly, so only these statuses get it
 *  success  complete, approved, paid, verified
 *  warning  waiting on a decision or due
 *  danger   failed, rejected, blocked, cancelled, suspended
 * @typedef {"neutral" | "info" | "accent" | "success" | "warning" | "danger" | "ink"} Tone
 */

/** @typedef {Record<string, { label: string; tone: Tone }>} StatusMap */

/** @type {StatusMap} */
export const PROJECT_STATUS = {
  DRAFT: { label: "Draft", tone: "neutral" },
  SUBMITTED: { label: "Submitted", tone: "accent" },
  QUOTING: { label: "Receiving quotes", tone: "accent" },
  QUOTATION_ACCEPTED: { label: "Quote accepted", tone: "success" },
  IN_PRODUCTION: { label: "In production", tone: "info" },
  QUALITY_CHECK: { label: "Quality check", tone: "warning" },
  READY_TO_SHIP: { label: "Ready to ship", tone: "info" },
  SHIPPED: { label: "Shipped", tone: "info" },
  DELIVERED: { label: "Delivered", tone: "success" },
  CANCELLED: { label: "Cancelled", tone: "danger" },
};

/** @type {StatusMap} */
export const ORDER_STATUS = {
  IN_PRODUCTION: { label: "In production", tone: "info" },
  QUALITY_CHECK: { label: "Quality check", tone: "warning" },
  READY_TO_SHIP: { label: "Ready to ship", tone: "info" },
  SHIPPED: { label: "Shipped", tone: "info" },
  DELIVERED: { label: "Delivered", tone: "success" },
  CANCELLED: { label: "Cancelled", tone: "danger" },
};

/** @type {StatusMap} */
export const QUOTATION_STATUS = {
  DRAFT: { label: "Draft", tone: "neutral" },
  SUBMITTED: { label: "Submitted", tone: "accent" },
  REVISION_REQUESTED: { label: "Revision requested", tone: "warning" },
  ACCEPTED: { label: "Accepted", tone: "success" },
  REJECTED: { label: "Declined", tone: "danger" },
  EXPIRED: { label: "Expired", tone: "neutral" },
  WITHDRAWN: { label: "Withdrawn", tone: "neutral" },
};

/** @type {StatusMap} */
export const MILESTONE_STATUS = {
  NOT_STARTED: { label: "Not started", tone: "neutral" },
  IN_PROGRESS: { label: "In progress", tone: "info" },
  AWAITING_APPROVAL: { label: "Awaiting approval", tone: "warning" },
  COMPLETED: { label: "Completed", tone: "success" },
  BLOCKED: { label: "Blocked", tone: "danger" },
};

/** @type {StatusMap} */
export const SAMPLE_STATUS = {
  SUBMITTED: { label: "Awaiting review", tone: "warning" },
  APPROVED: { label: "Approved", tone: "success" },
  REJECTED: { label: "Rejected", tone: "danger" },
  REVISION_REQUESTED: { label: "Revision requested", tone: "warning" },
};

/** @type {StatusMap} */
export const PAYMENT_STATUS = {
  SCHEDULED: { label: "Scheduled", tone: "neutral" },
  DUE: { label: "Due", tone: "warning" },
  PROCESSING: { label: "Processing", tone: "info" },
  PAID: { label: "Paid", tone: "success" },
  FAILED: { label: "Failed", tone: "danger" },
  REFUNDED: { label: "Refunded", tone: "neutral" },
};

/** @type {StatusMap} */
export const VERIFICATION_STATUS = {
  UNSUBMITTED: { label: "Not submitted", tone: "neutral" },
  PENDING: { label: "Under review", tone: "warning" },
  VERIFIED: { label: "Verified", tone: "success" },
  REJECTED: { label: "Not approved", tone: "danger" },
};

/** @type {StatusMap} */
export const DOCUMENT_STATUS = {
  PENDING: { label: "Pending review", tone: "warning" },
  VERIFIED: { label: "Verified", tone: "success" },
  REJECTED: { label: "Rejected", tone: "danger" },
};

/** @type {StatusMap} */
export const DISPUTE_STATUS = {
  OPEN: { label: "Open", tone: "warning" },
  IN_REVIEW: { label: "In review", tone: "info" },
  RESOLVED: { label: "Resolved", tone: "success" },
  CLOSED: { label: "Closed", tone: "neutral" },
};

/** @type {StatusMap} */
export const USER_STATUS = {
  ACTIVE: { label: "Active", tone: "success" },
  SUSPENDED: { label: "Suspended", tone: "danger" },
};

/** @type {StatusMap} */
export const INQUIRY_STATUS = {
  NEW: { label: "New", tone: "warning" },
  IN_PROGRESS: { label: "In progress", tone: "info" },
  RESOLVED: { label: "Resolved", tone: "success" },
};

/** @type {Record<string, string>} */
export const DISPUTE_CATEGORY = {
  QUALITY: "Quality",
  DELIVERY: "Delivery",
  PAYMENT: "Payment",
  COMMUNICATION: "Communication",
  OTHER: "Other",
};

/** @type {Record<string, string>} */
export const ROLE_LABEL = { BRAND: "Brand", MANUFACTURER: "Manufacturer", ADMIN: "Administrator" };

/** @type {Record<string, string>} */
export const DOCUMENT_TYPE = {
  CERTIFICATION: "Certification",
  BUSINESS_REGISTRATION: "Business registration",
  OTHER: "Other document",
};

/** @param {string} value */
export function categoryLabel(value) {
  return GARMENT_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

/**
 * Readable names for project fields, used wherever requirement changes are shown.
 * @type {Record<string, string>}
 */
export const PROJECT_FIELD_LABEL = {
  name: "Project name",
  category: "Category",
  description: "Product description",
  quantity: "Quantity",
  maxMoq: "MOQ limit",
  targetUnitPrice: "Target price",
  currency: "Currency",
  deadline: "Delivery date",
  fabricRequirements: "Fabric",
  fabrics: "Fabrics",
  sizes: "Sizes",
  colors: "Colours",
  additionalInstructions: "Instructions",
  requiredCapabilities: "Processes",
  preferredCountry: "Preferred country",
  requiredCertifications: "Certifications",
  sustainabilityNotes: "Sustainability notes",
  sampleRequired: "Samples requested",
  sampleQuantity: "Sample pieces",
  sampleSizes: "Sample sizes",
  sampleNotes: "Sample notes",
};

/**
 * Label for a project field; unknown keys are turned from camelCase into a sentence-case label.
 * @param {string} key
 */
export function fieldLabel(key) {
  if (PROJECT_FIELD_LABEL[key]) return PROJECT_FIELD_LABEL[key];
  const words = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const LONG_TEXT_FIELDS = new Set(["description", "additionalInstructions", "sustainabilityNotes", "fabricRequirements", "sampleNotes"]);

/**
 * One side of a stored requirement change (ProjectRevision.changes stores strings: ISO dates, JSON arrays,
 * numbers as text) formatted for people. `null` means the field was empty ("not set").
 * @param {string} field @param {string | null | undefined} raw @param {string} [currency]
 */
export function formatRevisionValue(field, raw, currency = "USD") {
  if (raw === null || raw === undefined || raw === "") return "not set";
  switch (field) {
    case "deadline":
      return formatDate(raw);
    case "targetUnitPrice":
      return Number.isFinite(Number(raw)) ? formatMoney(raw, currency) : raw;
    case "quantity":
    case "maxMoq":
    case "sampleQuantity":
      return Number.isFinite(Number(raw)) ? formatNumber(Number(raw)) : raw;
    case "category":
      return categoryLabel(raw);
    case "sampleRequired":
      return raw === "true" ? "Yes" : raw === "false" ? "No" : raw;
  }
  if (raw.startsWith("[")) {
    try {
      const list = JSON.parse(raw);
      if (Array.isArray(list)) return list.length ? list.map(String).join(", ") : "none";
    } catch {
      /* not JSON: show as text */
    }
  }
  if (LONG_TEXT_FIELDS.has(field) && raw.length > 80) return `${raw.slice(0, 79).trimEnd()}…`;
  return raw;
}

/**
 * "2 pieces · sizes M, L", or that no samples were requested. Used on the brief, the quote form and the comparison.
 * @param {{ sampleRequired: boolean; sampleQuantity: number | null; sampleSizes: string[] }} p
 */
export function sampleRequestSummary(p) {
  if (!p.sampleRequired) return "Not requested (pre-production sample only)";
  const pieces = p.sampleQuantity ? `${formatNumber(p.sampleQuantity)} ${p.sampleQuantity === 1 ? "piece" : "pieces"}` : "Requested";
  const sizes = p.sampleSizes.length ? `${p.sampleSizes.length === 1 ? "size" : "sizes"} ${p.sampleSizes.join(", ")}` : null;
  return [pieces, sizes].filter(Boolean).join(" · ");
}
