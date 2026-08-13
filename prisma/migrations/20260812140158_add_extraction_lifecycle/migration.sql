-- AlterEnum
ALTER TYPE "DocumentProcessingStatus" ADD VALUE 'REVIEW_REQUIRED';

-- AlterEnum
ALTER TYPE "IngestionStatus" ADD VALUE 'SUCCESS';

-- AlterTable
ALTER TABLE "IngestionRun" ADD COLUMN     "inputTokens" INTEGER,
ADD COLUMN     "model" TEXT,
ADD COLUMN     "outputTokens" INTEGER,
ADD COLUMN     "totalTokens" INTEGER;
