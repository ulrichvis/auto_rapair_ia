ALTER TYPE "IngestionStatus" ADD VALUE 'IMPORTING';
ALTER TYPE "IngestionStatus" ADD VALUE 'IMPORTED';

ALTER TABLE "IngestionRun"
ADD COLUMN "reviewedOutput" JSONB;

ALTER TABLE "TechnicalCase"
ADD COLUMN "importedAutomatically" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "reviewedByHuman" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "reviewedAt" TIMESTAMP(3);

UPDATE "TechnicalCase"
SET
  "reviewedByHuman" = true,
  "reviewedAt" = COALESCE("validatedAt", "updatedAt")
WHERE "validationStatus" = 'VALIDATED';

UPDATE "IngestionRun"
SET "status" = 'IMPORTED'
WHERE "importedAt" IS NOT NULL
  AND "status" IN ('SUCCESS', 'COMPLETED');
