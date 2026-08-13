-- Preserve unknown DTC roles instead of silently treating them as primary.
ALTER TABLE "CaseFaultCode" ALTER COLUMN "role" DROP DEFAULT,
ALTER COLUMN "role" DROP NOT NULL;

-- Mark a reviewed ingestion run after its relational import commits.
ALTER TABLE "IngestionRun" ADD COLUMN "importedAt" TIMESTAMP(3);

-- Keep exact provenance from validated cases to the reviewed ingestion run.
ALTER TABLE "TechnicalCase" ADD COLUMN "importedFromRunId" TEXT;

CREATE INDEX "IngestionRun_importedAt_idx" ON "IngestionRun"("importedAt");
CREATE INDEX "TechnicalCase_importedFromRunId_idx" ON "TechnicalCase"("importedFromRunId");

ALTER TABLE "TechnicalCase"
ADD CONSTRAINT "TechnicalCase_importedFromRunId_fkey"
FOREIGN KEY ("importedFromRunId") REFERENCES "IngestionRun"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
