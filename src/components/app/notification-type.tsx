import type { LucideIcon } from "lucide-react";
import {
  BadgeCheck, Bell, ClipboardCheck, Clock, CreditCard, Factory, FileSearch, FileText, MessageSquare, PackageCheck, PackagePlus, Scale, Send, Shirt, Truck, UserCog,
} from "lucide-react";
import type { NotificationType } from "@/generated/prisma/enums";

/** One icon per notification type, so a list can be scanned by kind (payments, samples, quotations…). */
const TYPE_ICON: Partial<Record<NotificationType, LucideIcon>> = {
  PROJECT_SUBMITTED: Send,
  MATCH_FOUND: FileSearch,
  QUOTATION_RECEIVED: FileText,
  QUOTATION_REVISION_REQUESTED: FileText,
  QUOTATION_REVISED: FileText,
  QUOTATION_ACCEPTED: FileText,
  QUOTATION_REJECTED: FileText,
  ORDER_CREATED: PackagePlus,
  MILESTONE_UPDATED: Factory,
  ORDER_DELAYED: Clock,
  SAMPLE_SUBMITTED: Shirt,
  SAMPLE_DECISION: Shirt,
  QC_REPORT_SUBMITTED: ClipboardCheck,
  QC_OUTCOME: ClipboardCheck,
  PAYMENT_UPDATE: CreditCard,
  ORDER_SHIPPED: Truck,
  ORDER_DELIVERED: PackageCheck,
  VERIFICATION_DECISION: BadgeCheck,
  DISPUTE_UPDATE: Scale,
  MESSAGE_RECEIVED: MessageSquare,
  ACCOUNT_STATUS: UserCog,
};

export function notificationIcon(type: NotificationType): LucideIcon {
  return TYPE_ICON[type] ?? Bell;
}

/** The type's icon, decorative (the title says what happened). */
export function NotificationTypeIcon({ type, className }: { type: NotificationType; className?: string }) {
  const Icon = TYPE_ICON[type] ?? Bell;
  return <Icon className={className} strokeWidth={1.75} aria-hidden />;
}

/** Types that usually ask the reader for a decision (a sample, a QC report, a quotation, a revision request). */
const DECISION_TYPES = new Set<NotificationType>(["SAMPLE_SUBMITTED", "QC_REPORT_SUBMITTED", "QUOTATION_RECEIVED", "QUOTATION_REVISION_REQUESTED"]);

export function asksForDecision(type: NotificationType) {
  return DECISION_TYPES.has(type);
}
