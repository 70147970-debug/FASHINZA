-- CreateEnum
CREATE TYPE "Role" AS ENUM ('BRAND', 'MANUFACTURER', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('UNSUBMITTED', 'PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "GarmentCategory" AS ENUM ('T_SHIRTS', 'SHIRTS', 'DRESSES', 'DENIM', 'TROUSERS', 'ACTIVEWEAR', 'OUTERWEAR', 'KNITWEAR', 'HOODIES_SWEATSHIRTS', 'KIDSWEAR', 'SLEEPWEAR', 'ACCESSORIES');

-- CreateEnum
CREATE TYPE "CapabilityKind" AS ENUM ('PRODUCTION', 'FABRIC', 'FINISHING');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('CERTIFICATION', 'BUSINESS_REGISTRATION', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'QUOTING', 'QUOTATION_ACCEPTED', 'IN_PRODUCTION', 'QUALITY_CHECK', 'READY_TO_SHIP', 'SHIPPED', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "QuotationStatus" AS ENUM ('ACTIVE', 'ACCEPTED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('IN_PRODUCTION', 'QUALITY_CHECK', 'READY_TO_SHIP', 'SHIPPED', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MilestoneStage" AS ENUM ('FABRIC_SOURCING', 'SAMPLING', 'CUTTING', 'STITCHING', 'FINISHING', 'QUALITY_CONTROL', 'SHIPPING', 'DELIVERY');

-- CreateEnum
CREATE TYPE "MilestoneStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "QCResult" AS ENUM ('PASS', 'FAIL');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('PROJECT_SUBMITTED', 'QUOTATION_RECEIVED', 'QUOTATION_ACCEPTED', 'QUOTATION_REJECTED', 'ORDER_CREATED', 'MILESTONE_UPDATED', 'QC_REPORT_SUBMITTED', 'ORDER_SHIPPED', 'ORDER_DELIVERED', 'VERIFICATION_DECISION', 'ACCOUNT_STATUS', 'SYSTEM');

-- CreateEnum
CREATE TYPE "InquiryStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'RESOLVED');

-- CreateEnum
CREATE TYPE "IssueStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'RESOLVED', 'CLOSED');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "role" "Role" NOT NULL DEFAULT 'BRAND',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "statusReason" TEXT,
    "profileCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "description" TEXT,
    "country" TEXT NOT NULL,
    "city" TEXT,
    "website" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manufacturer_profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "categories" "GarmentCategory"[],
    "minOrderQuantity" INTEGER NOT NULL,
    "maxMonthlyCapacity" INTEGER NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT,
    "website" TEXT,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNSUBMITTED',
    "verificationNote" TEXT,
    "verificationRequestedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "manufacturer_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manufacturer_capability" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "kind" "CapabilityKind" NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "manufacturer_capability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manufacturer_document" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "certificationName" TEXT,
    "fileKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING',
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "manufacturer_document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "GarmentCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "targetUnitPrice" DECIMAL(12,2),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "deadline" TIMESTAMP(3) NOT NULL,
    "fabricRequirements" TEXT NOT NULL,
    "sizes" TEXT[],
    "colors" TEXT NOT NULL,
    "additionalInstructions" TEXT,
    "requiredCapabilities" TEXT[],
    "preferredCountry" TEXT,
    "requiredCertifications" TEXT[],
    "status" "ProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_attachment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_revision" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "changedById" TEXT NOT NULL,
    "changes" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_revision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotation" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "manufacturerId" TEXT NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "minQuantity" INTEGER NOT NULL,
    "productionDays" INTEGER NOT NULL,
    "samplingCost" DECIMAL(12,2),
    "notes" TEXT,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "status" "QuotationStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotation_revision" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "minQuantity" INTEGER NOT NULL,
    "productionDays" INTEGER NOT NULL,
    "samplingCost" DECIMAL(12,2),
    "notes" TEXT,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quotation_revision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "manufacturerId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'IN_PRODUCTION',
    "expectedCompletionDate" TIMESTAMP(3) NOT NULL,
    "trackingInfo" TEXT,
    "shippedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_milestone" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "stage" "MilestoneStage" NOT NULL,
    "sequence" INTEGER NOT NULL,
    "status" "MilestoneStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "responsibleUserId" TEXT,
    "notes" TEXT,
    "attachmentKey" TEXT,
    "attachmentName" TEXT,
    "attachmentMime" TEXT,
    "isDelayed" BOOLEAN NOT NULL DEFAULT false,
    "delayReason" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "production_milestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qc_report" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "inspectorId" TEXT NOT NULL,
    "inspectionDate" TIMESTAMP(3) NOT NULL,
    "sampleSize" INTEGER NOT NULL,
    "defectiveCount" INTEGER NOT NULL,
    "defectRate" DECIMAL(5,2) NOT NULL,
    "defectDescriptions" TEXT,
    "notes" TEXT,
    "result" "QCResult" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "qc_report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qc_report_photo" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,

    CONSTRAINT "qc_report_photo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_log" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "orderId" TEXT,
    "actorId" TEXT,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_inquiry" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "company" TEXT,
    "inquiryType" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "InquiryStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_inquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issue_report" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "projectId" TEXT,
    "orderId" TEXT,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "IssueStatus" NOT NULL DEFAULT 'OPEN',
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "issue_report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "user_role_status_idx" ON "user"("role", "status");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "brand_profile_userId_key" ON "brand_profile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "manufacturer_profile_userId_key" ON "manufacturer_profile"("userId");

-- CreateIndex
CREATE INDEX "manufacturer_profile_verificationStatus_idx" ON "manufacturer_profile"("verificationStatus");

-- CreateIndex
CREATE INDEX "manufacturer_profile_country_idx" ON "manufacturer_profile"("country");

-- CreateIndex
CREATE INDEX "manufacturer_capability_name_idx" ON "manufacturer_capability"("name");

-- CreateIndex
CREATE UNIQUE INDEX "manufacturer_capability_profileId_kind_name_key" ON "manufacturer_capability"("profileId", "kind", "name");

-- CreateIndex
CREATE UNIQUE INDEX "manufacturer_document_fileKey_key" ON "manufacturer_document"("fileKey");

-- CreateIndex
CREATE INDEX "manufacturer_document_profileId_status_idx" ON "manufacturer_document"("profileId", "status");

-- CreateIndex
CREATE INDEX "project_brandId_status_idx" ON "project"("brandId", "status");

-- CreateIndex
CREATE INDEX "project_status_category_idx" ON "project"("status", "category");

-- CreateIndex
CREATE UNIQUE INDEX "project_attachment_fileKey_key" ON "project_attachment"("fileKey");

-- CreateIndex
CREATE INDEX "project_attachment_projectId_idx" ON "project_attachment"("projectId");

-- CreateIndex
CREATE INDEX "project_revision_projectId_createdAt_idx" ON "project_revision"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "quotation_manufacturerId_status_idx" ON "quotation"("manufacturerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "quotation_projectId_manufacturerId_key" ON "quotation"("projectId", "manufacturerId");

-- CreateIndex
CREATE UNIQUE INDEX "quotation_revision_quotationId_version_key" ON "quotation_revision"("quotationId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "order_reference_key" ON "order"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "order_projectId_key" ON "order"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "order_quotationId_key" ON "order"("quotationId");

-- CreateIndex
CREATE INDEX "order_brandId_status_idx" ON "order"("brandId", "status");

-- CreateIndex
CREATE INDEX "order_manufacturerId_status_idx" ON "order"("manufacturerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "production_milestone_orderId_stage_key" ON "production_milestone"("orderId", "stage");

-- CreateIndex
CREATE UNIQUE INDEX "production_milestone_orderId_sequence_key" ON "production_milestone"("orderId", "sequence");

-- CreateIndex
CREATE INDEX "qc_report_orderId_createdAt_idx" ON "qc_report"("orderId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "qc_report_photo_fileKey_key" ON "qc_report_photo"("fileKey");

-- CreateIndex
CREATE INDEX "activity_log_projectId_createdAt_idx" ON "activity_log"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "activity_log_orderId_createdAt_idx" ON "activity_log"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "notification_userId_readAt_createdAt_idx" ON "notification"("userId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "contact_inquiry_status_createdAt_idx" ON "contact_inquiry"("status", "createdAt");

-- CreateIndex
CREATE INDEX "issue_report_status_createdAt_idx" ON "issue_report"("status", "createdAt");

-- CreateIndex
CREATE INDEX "audit_log_targetType_targetId_idx" ON "audit_log"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "audit_log_createdAt_idx" ON "audit_log"("createdAt");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_profile" ADD CONSTRAINT "brand_profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manufacturer_profile" ADD CONSTRAINT "manufacturer_profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manufacturer_capability" ADD CONSTRAINT "manufacturer_capability_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "manufacturer_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manufacturer_document" ADD CONSTRAINT "manufacturer_document_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "manufacturer_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project" ADD CONSTRAINT "project_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_attachment" ADD CONSTRAINT "project_attachment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_attachment" ADD CONSTRAINT "project_attachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_revision" ADD CONSTRAINT "project_revision_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation" ADD CONSTRAINT "quotation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation" ADD CONSTRAINT "quotation_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_revision" ADD CONSTRAINT "quotation_revision_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "quotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order" ADD CONSTRAINT "order_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order" ADD CONSTRAINT "order_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "quotation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order" ADD CONSTRAINT "order_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order" ADD CONSTRAINT "order_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_milestone" ADD CONSTRAINT "production_milestone_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_milestone" ADD CONSTRAINT "production_milestone_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qc_report" ADD CONSTRAINT "qc_report_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qc_report" ADD CONSTRAINT "qc_report_inspectorId_fkey" FOREIGN KEY ("inspectorId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qc_report_photo" ADD CONSTRAINT "qc_report_photo_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "qc_report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_report" ADD CONSTRAINT "issue_report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_report" ADD CONSTRAINT "issue_report_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_report" ADD CONSTRAINT "issue_report_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
