-- Enforce that only a draft explicitly saved from human review can be imported.
ALTER TABLE "IngestionRun" ADD COLUMN "reviewedAt" TIMESTAMP(3);
