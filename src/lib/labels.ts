import { GARMENT_CATEGORIES } from "./constants";

/**
 * Status tones, one mapping used everywhere (see docs/design-system.md#status):
 *  neutral  not started, draft, closed, withdrawn
 *  info     moving normally: in progress, in production, in transit
 *  accent   open in the marketplace, waiting for factories (submitted, receiving quotes) — terracotta is
 *           used sparingly, so only these statuses get it
 *  success  complete, approved, paid, verified
 *  warning  waiting on a decision or due
 *  danger   failed, rejected, blocked, cancelled, suspended
 */
export type Tone = "neutral" | "info" | "accent" | "success" | "warning" | "danger" | "ink";

type StatusMap = Record<string, { label: string; tone: Tone }>;

export const PROJECT_STATUS: StatusMap = {
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

export const ORDER_STATUS: StatusMap = {
  IN_PRODUCTION: { label: "In production", tone: "info" },
  QUALITY_CHECK: { label: "Quality check", tone: "warning" },
  READY_TO_SHIP: { label: "Ready to ship", tone: "info" },
  SHIPPED: { label: "Shipped", tone: "info" },
  DELIVERED: { label: "Delivered", tone: "success" },
  CANCELLED: { label: "Cancelled", tone: "danger" },
};

export const QUOTATION_STATUS: StatusMap = {
  DRAFT: { label: "Draft", tone: "neutral" },
  SUBMITTED: { label: "Submitted", tone: "accent" },
  REVISION_REQUESTED: { label: "Revision requested", tone: "warning" },
  ACCEPTED: { label: "Accepted", tone: "success" },
  REJECTED: { label: "Declined", tone: "danger" },
  EXPIRED: { label: "Expired", tone: "neutral" },
  WITHDRAWN: { label: "Withdrawn", tone: "neutral" },
};

export const MILESTONE_STATUS: StatusMap = {
  NOT_STARTED: { label: "Not started", tone: "neutral" },
  IN_PROGRESS: { label: "In progress", tone: "info" },
  AWAITING_APPROVAL: { label: "Awaiting approval", tone: "warning" },
  COMPLETED: { label: "Completed", tone: "success" },
  BLOCKED: { label: "Blocked", tone: "danger" },
};

export const SAMPLE_STATUS: StatusMap = {
  SUBMITTED: { label: "Awaiting review", tone: "warning" },
  APPROVED: { label: "Approved", tone: "success" },
  REJECTED: { label: "Rejected", tone: "danger" },
  REVISION_REQUESTED: { label: "Revision requested", tone: "warning" },
};

export const PAYMENT_STATUS: StatusMap = {
  SCHEDULED: { label: "Scheduled", tone: "neutral" },
  DUE: { label: "Due", tone: "warning" },
  PROCESSING: { label: "Processing", tone: "info" },
  PAID: { label: "Paid", tone: "success" },
  FAILED: { label: "Failed", tone: "danger" },
  REFUNDED: { label: "Refunded", tone: "neutral" },
};

export const VERIFICATION_STATUS: StatusMap = {
  UNSUBMITTED: { label: "Not submitted", tone: "neutral" },
  PENDING: { label: "Under review", tone: "warning" },
  VERIFIED: { label: "Verified", tone: "success" },
  REJECTED: { label: "Not approved", tone: "danger" },
};

export const DOCUMENT_STATUS: StatusMap = {
  PENDING: { label: "Pending review", tone: "warning" },
  VERIFIED: { label: "Verified", tone: "success" },
  REJECTED: { label: "Rejected", tone: "danger" },
};

export const DISPUTE_STATUS: StatusMap = {
  OPEN: { label: "Open", tone: "warning" },
  IN_REVIEW: { label: "In review", tone: "info" },
  RESOLVED: { label: "Resolved", tone: "success" },
  CLOSED: { label: "Closed", tone: "neutral" },
};

export const USER_STATUS: StatusMap = {
  ACTIVE: { label: "Active", tone: "success" },
  SUSPENDED: { label: "Suspended", tone: "danger" },
};

export const INQUIRY_STATUS: StatusMap = {
  NEW: { label: "New", tone: "warning" },
  IN_PROGRESS: { label: "In progress", tone: "info" },
  RESOLVED: { label: "Resolved", tone: "success" },
};

export const DISPUTE_CATEGORY: Record<string, string> = {
  QUALITY: "Quality",
  DELIVERY: "Delivery",
  PAYMENT: "Payment",
  COMMUNICATION: "Communication",
  OTHER: "Other",
};

export const ROLE_LABEL: Record<string, string> = { BRAND: "Brand", MANUFACTURER: "Manufacturer", ADMIN: "Administrator" };

export const DOCUMENT_TYPE: Record<string, string> = {
  CERTIFICATION: "Certification",
  BUSINESS_REGISTRATION: "Business registration",
  OTHER: "Other document",
};

export function categoryLabel(value: string) {
  return GARMENT_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}
