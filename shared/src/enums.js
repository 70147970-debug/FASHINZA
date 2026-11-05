/**
 * Enumerations from prisma/schema.prisma, in declaration order. The order matters wherever the old
 * PostgreSQL queries sorted by an enum column (PostgreSQL sorts enums by declaration order).
 * Generated from src/generated/prisma/enums.ts; keep in sync with the schema.
 */

/** @type {readonly ["BRAND", "MANUFACTURER", "ADMIN"]} */
export const Role = Object.freeze(["BRAND", "MANUFACTURER", "ADMIN"]);

/** @type {readonly ["ACTIVE", "SUSPENDED"]} */
export const UserStatus = Object.freeze(["ACTIVE", "SUSPENDED"]);

/** @type {readonly ["UNSUBMITTED", "PENDING", "VERIFIED", "REJECTED"]} */
export const VerificationStatus = Object.freeze(["UNSUBMITTED", "PENDING", "VERIFIED", "REJECTED"]);

/** @type {readonly ["T_SHIRTS", "SHIRTS", "DRESSES", "DENIM", "TROUSERS", "ACTIVEWEAR", "OUTERWEAR", "KNITWEAR", "HOODIES_SWEATSHIRTS", "KIDSWEAR", "SLEEPWEAR", "ACCESSORIES"]} */
export const GarmentCategory = Object.freeze(["T_SHIRTS", "SHIRTS", "DRESSES", "DENIM", "TROUSERS", "ACTIVEWEAR", "OUTERWEAR", "KNITWEAR", "HOODIES_SWEATSHIRTS", "KIDSWEAR", "SLEEPWEAR", "ACCESSORIES"]);

/** @type {readonly ["PRODUCTION", "FABRIC", "FINISHING"]} */
export const CapabilityKind = Object.freeze(["PRODUCTION", "FABRIC", "FINISHING"]);

/** @type {readonly ["CERTIFICATION", "BUSINESS_REGISTRATION", "OTHER"]} */
export const DocumentType = Object.freeze(["CERTIFICATION", "BUSINESS_REGISTRATION", "OTHER"]);

/** @type {readonly ["PENDING", "VERIFIED", "REJECTED"]} */
export const DocumentStatus = Object.freeze(["PENDING", "VERIFIED", "REJECTED"]);

/** @type {readonly ["DRAFT", "SUBMITTED", "QUOTING", "QUOTATION_ACCEPTED", "IN_PRODUCTION", "QUALITY_CHECK", "READY_TO_SHIP", "SHIPPED", "DELIVERED", "CANCELLED"]} */
export const ProjectStatus = Object.freeze(["DRAFT", "SUBMITTED", "QUOTING", "QUOTATION_ACCEPTED", "IN_PRODUCTION", "QUALITY_CHECK", "READY_TO_SHIP", "SHIPPED", "DELIVERED", "CANCELLED"]);

/** @type {readonly ["TECH_PACK", "SKETCH", "OTHER", "REFERENCE_IMAGE", "MEASUREMENT_CHART"]} */
export const AttachmentKind = Object.freeze(["TECH_PACK", "SKETCH", "OTHER", "REFERENCE_IMAGE", "MEASUREMENT_CHART"]);

/** @type {readonly ["DRAFT", "SUBMITTED", "REVISION_REQUESTED", "ACCEPTED", "REJECTED", "EXPIRED", "WITHDRAWN"]} */
export const QuotationStatus = Object.freeze(["DRAFT", "SUBMITTED", "REVISION_REQUESTED", "ACCEPTED", "REJECTED", "EXPIRED", "WITHDRAWN"]);

/** @type {readonly ["IN_PRODUCTION", "QUALITY_CHECK", "READY_TO_SHIP", "SHIPPED", "DELIVERED", "CANCELLED"]} */
export const OrderStatus = Object.freeze(["IN_PRODUCTION", "QUALITY_CHECK", "READY_TO_SHIP", "SHIPPED", "DELIVERED", "CANCELLED"]);

/** @type {readonly ["FABRIC_SOURCING", "SAMPLING", "CUTTING", "STITCHING", "FINISHING", "QUALITY_CONTROL", "SHIPPING", "DELIVERY"]} */
export const MilestoneStage = Object.freeze(["FABRIC_SOURCING", "SAMPLING", "CUTTING", "STITCHING", "FINISHING", "QUALITY_CONTROL", "SHIPPING", "DELIVERY"]);

/** @type {readonly ["NOT_STARTED", "IN_PROGRESS", "AWAITING_APPROVAL", "COMPLETED", "BLOCKED"]} */
export const MilestoneStatus = Object.freeze(["NOT_STARTED", "IN_PROGRESS", "AWAITING_APPROVAL", "COMPLETED", "BLOCKED"]);

/** @type {readonly ["BRAND", "MANUFACTURER"]} */
export const ResponsibleParty = Object.freeze(["BRAND", "MANUFACTURER"]);

/** @type {readonly ["SUBMITTED", "APPROVED", "REJECTED", "REVISION_REQUESTED"]} */
export const SampleStatus = Object.freeze(["SUBMITTED", "APPROVED", "REJECTED", "REVISION_REQUESTED"]);

/** @type {readonly ["PASS", "FAIL"]} */
export const QCResult = Object.freeze(["PASS", "FAIL"]);

/** @type {readonly ["CRITICAL", "MAJOR", "MINOR"]} */
export const DefectSeverity = Object.freeze(["CRITICAL", "MAJOR", "MINOR"]);

/** @type {readonly ["PENDING", "ACCEPTED", "REJECTED"]} */
export const QCDecision = Object.freeze(["PENDING", "ACCEPTED", "REJECTED"]);

/** @type {readonly ["OPEN", "COMPLETED"]} */
export const ReworkStatus = Object.freeze(["OPEN", "COMPLETED"]);

/** @type {readonly ["SCHEDULED", "DUE", "PROCESSING", "PAID", "FAILED", "REFUNDED"]} */
export const PaymentMilestoneStatus = Object.freeze(["SCHEDULED", "DUE", "PROCESSING", "PAID", "FAILED", "REFUNDED"]);

/** @type {readonly ["CHARGE", "REFUND"]} */
export const TransactionType = Object.freeze(["CHARGE", "REFUND"]);

/** @type {readonly ["PENDING", "SUCCEEDED", "FAILED"]} */
export const TransactionStatus = Object.freeze(["PENDING", "SUCCEEDED", "FAILED"]);

/** @type {readonly ["PROJECT_SUBMITTED", "MATCH_FOUND", "QUOTATION_RECEIVED", "QUOTATION_REVISION_REQUESTED", "QUOTATION_REVISED", "QUOTATION_ACCEPTED", "QUOTATION_REJECTED", "ORDER_CREATED", "MILESTONE_UPDATED", "ORDER_DELAYED", "SAMPLE_SUBMITTED", "SAMPLE_DECISION", "QC_REPORT_SUBMITTED", "QC_OUTCOME", "PAYMENT_UPDATE", "ORDER_SHIPPED", "ORDER_DELIVERED", "VERIFICATION_DECISION", "DISPUTE_UPDATE", "MESSAGE_RECEIVED", "ACCOUNT_STATUS", "SYSTEM"]} */
export const NotificationType = Object.freeze(["PROJECT_SUBMITTED", "MATCH_FOUND", "QUOTATION_RECEIVED", "QUOTATION_REVISION_REQUESTED", "QUOTATION_REVISED", "QUOTATION_ACCEPTED", "QUOTATION_REJECTED", "ORDER_CREATED", "MILESTONE_UPDATED", "ORDER_DELAYED", "SAMPLE_SUBMITTED", "SAMPLE_DECISION", "QC_REPORT_SUBMITTED", "QC_OUTCOME", "PAYMENT_UPDATE", "ORDER_SHIPPED", "ORDER_DELIVERED", "VERIFICATION_DECISION", "DISPUTE_UPDATE", "MESSAGE_RECEIVED", "ACCOUNT_STATUS", "SYSTEM"]);

/** @type {readonly ["NEW", "IN_PROGRESS", "RESOLVED"]} */
export const InquiryStatus = Object.freeze(["NEW", "IN_PROGRESS", "RESOLVED"]);

/** @type {readonly ["OPEN", "IN_REVIEW", "RESOLVED", "CLOSED"]} */
export const IssueStatus = Object.freeze(["OPEN", "IN_REVIEW", "RESOLVED", "CLOSED"]);

/** @type {readonly ["QUALITY", "DELIVERY", "PAYMENT", "COMMUNICATION", "OTHER"]} */
export const IssueCategory = Object.freeze(["QUALITY", "DELIVERY", "PAYMENT", "COMMUNICATION", "OTHER"]);

/** Index of a value in its enum (for sorting like PostgreSQL). Unknown values sort last. */
export function enumRank(values, value) {
  const i = values.indexOf(value);
  return i === -1 ? values.length : i;
}
