ALTER TABLE "IngestionRun"
ADD COLUMN "originalFileSizeBytes" INTEGER,
ADD COLUMN "processingFileSizeBytes" INTEGER,
ADD COLUMN "processingWasOptimized" BOOLEAN,
ADD COLUMN "processingWarning" TEXT;
