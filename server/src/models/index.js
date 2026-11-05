/** Every Mongoose model (one per Prisma model, collection = the Prisma @@map name). */
import { Account } from "./Account.js";
import { ActivityLog } from "./ActivityLog.js";
import { AuditLog } from "./AuditLog.js";
import { BrandProfile } from "./BrandProfile.js";
import { ContactInquiry } from "./ContactInquiry.js";
import { IssueReport } from "./IssueReport.js";
import { ManufacturerCapability } from "./ManufacturerCapability.js";
import { ManufacturerDocument } from "./ManufacturerDocument.js";
import { ManufacturerMachine } from "./ManufacturerMachine.js";
import { ManufacturerProfile } from "./ManufacturerProfile.js";
import { MatchResult } from "./MatchResult.js";
import { Message } from "./Message.js";
import { MilestoneEvidence } from "./MilestoneEvidence.js";
import { Notification } from "./Notification.js";
import { Order } from "./Order.js";
import { PaymentMilestone } from "./PaymentMilestone.js";
import { PaymentTransaction } from "./PaymentTransaction.js";
import { ProductionMilestone } from "./ProductionMilestone.js";
import { Project } from "./Project.js";
import { ProjectAttachment } from "./ProjectAttachment.js";
import { ProjectRevision } from "./ProjectRevision.js";
import { QCDefect } from "./QCDefect.js";
import { QCReport } from "./QCReport.js";
import { QCReportPhoto } from "./QCReportPhoto.js";
import { Quotation } from "./Quotation.js";
import { QuotationRevision } from "./QuotationRevision.js";
import { ReworkTask } from "./ReworkTask.js";
import { Sample } from "./Sample.js";
import { SamplePhoto } from "./SamplePhoto.js";
import { Session } from "./Session.js";
import { User } from "./User.js";
import { Verification } from "./Verification.js";
import { WebhookEvent } from "./WebhookEvent.js";

export {
  Account,
  ActivityLog,
  AuditLog,
  BrandProfile,
  ContactInquiry,
  IssueReport,
  ManufacturerCapability,
  ManufacturerDocument,
  ManufacturerMachine,
  ManufacturerProfile,
  MatchResult,
  Message,
  MilestoneEvidence,
  Notification,
  Order,
  PaymentMilestone,
  PaymentTransaction,
  ProductionMilestone,
  Project,
  ProjectAttachment,
  ProjectRevision,
  QCDefect,
  QCReport,
  QCReportPhoto,
  Quotation,
  QuotationRevision,
  ReworkTask,
  Sample,
  SamplePhoto,
  Session,
  User,
  Verification,
  WebhookEvent,
};

/** All models, for index syncing and test resets. */
export const ALL_MODELS = [
  Account,
  ActivityLog,
  AuditLog,
  BrandProfile,
  ContactInquiry,
  IssueReport,
  ManufacturerCapability,
  ManufacturerDocument,
  ManufacturerMachine,
  ManufacturerProfile,
  MatchResult,
  Message,
  MilestoneEvidence,
  Notification,
  Order,
  PaymentMilestone,
  PaymentTransaction,
  ProductionMilestone,
  Project,
  ProjectAttachment,
  ProjectRevision,
  QCDefect,
  QCReport,
  QCReportPhoto,
  Quotation,
  QuotationRevision,
  ReworkTask,
  Sample,
  SamplePhoto,
  Session,
  User,
  Verification,
  WebhookEvent,
];
