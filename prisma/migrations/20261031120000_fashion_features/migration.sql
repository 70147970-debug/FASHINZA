-- Fashion-specific features: reference images and measurement charts, sample requests on the brief,
-- sample proposals on quotations and factory machinery.

-- AlterEnum
ALTER TYPE "AttachmentKind" ADD VALUE 'REFERENCE_IMAGE';
ALTER TYPE "AttachmentKind" ADD VALUE 'MEASUREMENT_CHART';

-- AlterTable
ALTER TABLE "project" ADD COLUMN     "sampleNotes" TEXT,
ADD COLUMN     "sampleQuantity" INTEGER DEFAULT 1,
ADD COLUMN     "sampleRequired" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "sampleSizes" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "quotation" ADD COLUMN     "sampleLeadTimeDays" INTEGER,
ADD COLUMN     "sampleNotes" TEXT;

-- CreateTable
CREATE TABLE "manufacturer_machine" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "manufacturer_machine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "manufacturer_machine_profileId_type_key" ON "manufacturer_machine"("profileId", "type");

-- AddForeignKey
ALTER TABLE "manufacturer_machine" ADD CONSTRAINT "manufacturer_machine_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "manufacturer_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The wizard gained a "Samples" step (5) before "Tech pack & files" (now 6) and "Review & submit" (now 7).
-- Keep drafts on the step they had reached and submitted projects on the final step.
UPDATE "project" SET "wizardStep" = "wizardStep" + 1 WHERE "wizardStep" >= 5;
