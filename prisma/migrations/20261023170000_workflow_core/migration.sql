-- CreateEnum
CREATE TYPE "AttachmentKind" AS ENUM ('TECH_PACK', 'SKETCH', 'OTHER');

-- CreateEnum
CREATE TYPE "ResponsibleParty" AS ENUM ('BRAND', 'MANUFACTURER');

-- CreateEnum
CREATE TYPE "SampleStatus" AS ENUM ('SUBMITTED', 'APPROVED', 'REJECTED', 'REVISION_REQUESTED');

-- CreateEnum
CREATE TYPE "DefectSeverity" AS ENUM ('CRITICAL', 'MAJOR', 'MINOR');

-- CreateEnum
CREATE TYPE "QCDecision" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ReworkStatus" AS ENUM ('OPEN', 'COMPLETED');

-- CreateEnum
CREATE TYPE "PaymentMilestoneStatus" AS ENUM ('SCHEDULED', 'DUE', 'PROCESSING', 'PAID', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('CHARGE', 'REFUND');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "IssueCategory" AS ENUM ('QUALITY', 'DELIVERY', 'PAYMENT', 'COMMUNICATION', 'OTHER');

-- AlterEnum
ALTER TYPE "MilestoneStatus" ADD VALUE 'AWAITING_APPROVAL';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'MATCH_FOUND';
ALTER TYPE "NotificationType" ADD VALUE 'QUOTATION_REVISION_REQUESTED';
ALTER TYPE "NotificationType" ADD VALUE 'QUOTATION_REVISED';
ALTER TYPE "NotificationType" ADD VALUE 'ORDER_DELAYED';
ALTER TYPE "NotificationType" ADD VALUE 'SAMPLE_SUBMITTED';
ALTER TYPE "NotificationType" ADD VALUE 'SAMPLE_DECISION';
ALTER TYPE "NotificationType" ADD VALUE 'QC_OUTCOME';
ALTER TYPE "NotificationType" ADD VALUE 'PAYMENT_UPDATE';
ALTER TYPE "NotificationType" ADD VALUE 'DISPUTE_UPDATE';
ALTER TYPE "NotificationType" ADD VALUE 'MESSAGE_RECEIVED';

-- AlterEnum (existing ACTIVE quotations were submitted offers, so they map to SUBMITTED)
BEGIN;
CREATE TYPE "QuotationStatus_new" AS ENUM ('DRAFT', 'SUBMITTED', 'REVISION_REQUESTED', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'WITHDRAWN');
ALTER TABLE "public"."quotation" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "quotation" ALTER COLUMN "status" TYPE "QuotationStatus_new" USING ((CASE WHEN "status"::text = 'ACTIVE' THEN 'SUBMITTED' ELSE "status"::text END)::"QuotationStatus_new");
ALTER TYPE "QuotationStatus" RENAME TO "QuotationStatus_old";
ALTER TYPE "QuotationStatus_new" RENAME TO "QuotationStatus";
DROP TYPE "public"."QuotationStatus_old";
ALTER TABLE "quotation" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
COMMIT;

-- AlterTable
ALTER TABLE "issue_report" ADD COLUMN     "category" "IssueCategory" NOT NULL DEFAULT 'OTHER',
ADD COLUMN     "resolution" TEXT,
ADD COLUMN     "resolvedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "manufacturer_profile" ADD COLUMN     "typicalLeadTimeDays" INTEGER NOT NULL DEFAULT 45;

-- AlterTable
ALTER TABLE "order" ADD COLUMN     "agreedTerms" JSONB,
ADD COLUMN     "currentStage" "MilestoneStage" NOT NULL DEFAULT 'FABRIC_SOURCING',
ADD COLUMN     "totalAmount" DECIMAL(14,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "production_milestone" ADD COLUMN     "evidenceRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "plannedEnd" TIMESTAMP(3),
ADD COLUMN     "plannedStart" TIMESTAMP(3),
ADD COLUMN     "responsibleParty" "ResponsibleParty" NOT NULL DEFAULT 'MANUFACTURER';

-- AlterTable
ALTER TABLE "project" ADD COLUMN     "fabrics" TEXT[],
ADD COLUMN     "maxMoq" INTEGER,
ADD COLUMN     "sustainabilityNotes" TEXT,
ADD COLUMN     "wizardStep" INTEGER NOT NULL DEFAULT 1,
ALTER COLUMN "description" DROP NOT NULL,
ALTER COLUMN "quantity" DROP NOT NULL,
ALTER COLUMN "deadline" DROP NOT NULL,
ALTER COLUMN "fabricRequirements" DROP NOT NULL,
ALTER COLUMN "colors" DROP NOT NULL;

-- AlterTable
ALTER TABLE "project_attachment" ADD COLUMN     "kind" "AttachmentKind" NOT NULL DEFAULT 'OTHER',
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "version" INTEGER;

-- AlterTable
ALTER TABLE "qc_report" ADD COLUMN     "acceptMajor" INTEGER,
ADD COLUMN     "acceptMinor" INTEGER,
ADD COLUMN     "aqlMajor" DECIMAL(4,2),
ADD COLUMN     "aqlMinor" DECIMAL(4,2),
ADD COLUMN     "batchSize" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "brandDecision" "QCDecision" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "brandDecisionNote" TEXT,
ADD COLUMN     "correctiveActions" TEXT,
ADD COLUMN     "criticalCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "decidedAt" TIMESTAMP(3),
ADD COLUMN     "inspectionStandard" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "majorCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "minorCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "quotation" ADD COLUMN     "decidedAt" TIMESTAMP(3),
ADD COLUMN     "fabricCostPerUnit" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "finishingCostPerUnit" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "logisticsCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "packagingCostPerUnit" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "quantity" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "revisionRequest" TEXT,
ADD COLUMN     "submittedAt" TIMESTAMP(3),
ADD COLUMN     "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "taxAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "taxPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "totalAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
ALTER COLUMN "status" SET DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "quotation_revision" ADD COLUMN     "snapshot" JSONB;

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "lastLoginAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "match_result" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "manufacturerId" TEXT NOT NULL,
    "score" DECIMAL(5,2) NOT NULL,
    "breakdown" JSONB NOT NULL,
    "reasons" TEXT[],
    "algorithm" TEXT NOT NULL,
    "invitedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_result_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "milestone_evidence" (
    "id" TEXT NOT NULL,
    "milestoneId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "milestone_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sample" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "revisionNotes" TEXT,
    "status" "SampleStatus" NOT NULL DEFAULT 'SUBMITTED',
    "feedback" TEXT,
    "submittedById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sample_photo" (
    "id" TEXT NOT NULL,
    "sampleId" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,

    CONSTRAINT "sample_photo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qc_defect" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "severity" "DefectSeverity" NOT NULL,
    "count" INTEGER NOT NULL,

    CONSTRAINT "qc_defect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rework_task" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "qcReportId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "ReworkStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rework_task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_milestone" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "percentage" DECIMAL(5,2) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "triggerStage" "MilestoneStage" NOT NULL,
    "status" "PaymentMilestoneStatus" NOT NULL DEFAULT 'SCHEDULED',
    "dueAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_milestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_transaction" (
    "id" TEXT NOT NULL,
    "paymentMilestoneId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerRef" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "failureReason" TEXT,
    "initiatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_event" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "signatureValid" BOOLEAN NOT NULL,
    "processedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "milestoneId" TEXT,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "match_result_manufacturerId_createdAt_idx" ON "match_result"("manufacturerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "match_result_projectId_manufacturerId_key" ON "match_result"("projectId", "manufacturerId");

-- CreateIndex
CREATE UNIQUE INDEX "milestone_evidence_fileKey_key" ON "milestone_evidence"("fileKey");

-- CreateIndex
CREATE INDEX "milestone_evidence_milestoneId_idx" ON "milestone_evidence"("milestoneId");

-- CreateIndex
CREATE UNIQUE INDEX "sample_orderId_round_key" ON "sample"("orderId", "round");

-- CreateIndex
CREATE UNIQUE INDEX "sample_photo_fileKey_key" ON "sample_photo"("fileKey");

-- CreateIndex
CREATE INDEX "sample_photo_sampleId_idx" ON "sample_photo"("sampleId");

-- CreateIndex
CREATE INDEX "qc_defect_reportId_idx" ON "qc_defect"("reportId");

-- CreateIndex
CREATE UNIQUE INDEX "rework_task_qcReportId_key" ON "rework_task"("qcReportId");

-- CreateIndex
CREATE INDEX "rework_task_orderId_status_idx" ON "rework_task"("orderId", "status");

-- CreateIndex
CREATE INDEX "payment_milestone_status_idx" ON "payment_milestone"("status");

-- CreateIndex
CREATE UNIQUE INDEX "payment_milestone_orderId_sequence_key" ON "payment_milestone"("orderId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "payment_transaction_providerRef_key" ON "payment_transaction"("providerRef");

-- CreateIndex
CREATE INDEX "payment_transaction_paymentMilestoneId_createdAt_idx" ON "payment_transaction"("paymentMilestoneId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_event_provider_eventId_key" ON "webhook_event"("provider", "eventId");

-- CreateIndex
CREATE INDEX "message_orderId_createdAt_idx" ON "message"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "issue_report_reporterId_idx" ON "issue_report"("reporterId");

-- CreateIndex
CREATE INDEX "issue_report_orderId_idx" ON "issue_report"("orderId");

-- CreateIndex
CREATE INDEX "order_status_expectedCompletionDate_idx" ON "order"("status", "expectedCompletionDate");

-- CreateIndex
CREATE INDEX "production_milestone_status_plannedEnd_idx" ON "production_milestone"("status", "plannedEnd");

-- CreateIndex
CREATE UNIQUE INDEX "project_attachment_projectId_kind_version_key" ON "project_attachment"("projectId", "kind", "version");

-- CreateIndex
CREATE INDEX "quotation_projectId_status_idx" ON "quotation"("projectId", "status");

-- AddForeignKey
ALTER TABLE "match_result" ADD CONSTRAINT "match_result_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_result" ADD CONSTRAINT "match_result_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestone_evidence" ADD CONSTRAINT "milestone_evidence_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "production_milestone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestone_evidence" ADD CONSTRAINT "milestone_evidence_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sample" ADD CONSTRAINT "sample_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sample" ADD CONSTRAINT "sample_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sample" ADD CONSTRAINT "sample_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sample_photo" ADD CONSTRAINT "sample_photo_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "sample"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qc_defect" ADD CONSTRAINT "qc_defect_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "qc_report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rework_task" ADD CONSTRAINT "rework_task_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rework_task" ADD CONSTRAINT "rework_task_qcReportId_fkey" FOREIGN KEY ("qcReportId") REFERENCES "qc_report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_milestone" ADD CONSTRAINT "payment_milestone_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_transaction" ADD CONSTRAINT "payment_transaction_paymentMilestoneId_fkey" FOREIGN KEY ("paymentMilestoneId") REFERENCES "payment_milestone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message" ADD CONSTRAINT "message_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message" ADD CONSTRAINT "message_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "production_milestone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message" ADD CONSTRAINT "message_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Data preservation: move single-file milestone attachments into milestone_evidence,
-- then drop the old columns.
INSERT INTO "milestone_evidence" ("id", "milestoneId", "uploadedById", "fileKey", "fileName", "mimeType", "size", "createdAt")
SELECT gen_random_uuid()::text, pm."id", COALESCE(pm."responsibleUserId", o."manufacturerId"), pm."attachmentKey",
       COALESCE(pm."attachmentName", 'evidence'), COALESCE(pm."attachmentMime", 'application/octet-stream'), 0, pm."updatedAt"
FROM "production_milestone" pm JOIN "order" o ON o."id" = pm."orderId"
WHERE pm."attachmentKey" IS NOT NULL;

ALTER TABLE "production_milestone" DROP COLUMN "attachmentKey",
DROP COLUMN "attachmentMime",
DROP COLUMN "attachmentName";

-- Data preservation: backfill totals for quotations and orders created before cost breakdowns existed.
UPDATE "quotation" q SET
  "quantity" = COALESCE(p."quantity", q."minQuantity"),
  "subtotal" = q."unitPrice" * COALESCE(p."quantity", q."minQuantity") + COALESCE(q."samplingCost", 0),
  "totalAmount" = q."unitPrice" * COALESCE(p."quantity", q."minQuantity") + COALESCE(q."samplingCost", 0),
  "submittedAt" = q."createdAt"
FROM "project" p WHERE p."id" = q."projectId";

UPDATE "order" SET "totalAmount" = "unitPrice" * "quantity";

