-- CreateEnum
CREATE TYPE "DocumentProcessingStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "IngestionStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'PURGED');

-- CreateEnum
CREATE TYPE "ValidationStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'VALIDATED', 'REJECTED');

-- CreateEnum
CREATE TYPE "EngineMatchType" AS ENUM ('EXACT', 'PREFIX', 'PATTERN', 'FAMILY', 'ALL');

-- CreateEnum
CREATE TYPE "FaultCodeRole" AS ENUM ('PRIMARY', 'RELATED', 'CONSEQUENTIAL');

-- CreateEnum
CREATE TYPE "CauseCertainty" AS ENUM ('POSSIBLE', 'PROBABLE', 'CONFIRMED');

-- CreateEnum
CREATE TYPE "SolutionType" AS ENUM ('REPAIR', 'REPLACE', 'CLEAN', 'ADJUST', 'CALIBRATE', 'SOFTWARE_UPDATE', 'REGENERATE', 'RESET', 'OTHER');

-- CreateEnum
CREATE TYPE "ProcedureType" AS ENUM ('DIAGNOSTIC', 'REPAIR', 'CALIBRATION', 'VERIFICATION');

-- CreateEnum
CREATE TYPE "NoteType" AS ENUM ('GENERAL', 'WARNING', 'LIMITATION', 'EXCEPTION', 'VARIANT', 'TECHNICAL');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'DIAGRAM', 'WIRING_DIAGRAM', 'CHART', 'WAVEFORM', 'SCREENSHOT', 'OTHER');

-- CreateTable
CREATE TABLE "SourceDocument" (
    "id" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "title" TEXT,
    "bulletinReference" TEXT,
    "publisher" TEXT,
    "language" TEXT,
    "storagePath" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "pageCount" INTEGER,
    "claimedPageCount" INTEGER,
    "isComplete" BOOLEAN,
    "processingStatus" "DocumentProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "allowPdfDisplay" BOOLEAN NOT NULL DEFAULT false,
    "allowMediaReuse" BOOLEAN NOT NULL DEFAULT false,
    "rightsNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestionRun" (
    "id" TEXT NOT NULL,
    "sourceDocumentId" TEXT NOT NULL,
    "status" "IngestionStatus" NOT NULL DEFAULT 'PENDING',
    "extractor" TEXT,
    "extractorVersion" TEXT,
    "rawOutput" JSONB,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "purgedAt" TIMESTAMP(3),

    CONSTRAINT "IngestionRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TechnicalCase" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "problemDescription" TEXT,
    "primarySystem" TEXT,
    "validationStatus" "ValidationStatus" NOT NULL DEFAULT 'DRAFT',
    "reviewNotes" TEXT,
    "validatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TechnicalCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseSource" (
    "id" TEXT NOT NULL,
    "technicalCaseId" TEXT NOT NULL,
    "sourceDocumentId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CaseSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseApplicability" (
    "id" TEXT NOT NULL,
    "technicalCaseId" TEXT NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "generationOrPlatform" TEXT,
    "yearFrom" INTEGER,
    "yearTo" INTEGER,
    "engineLabel" TEXT,
    "engineFamily" TEXT,
    "engineCode" TEXT,
    "engineCodePattern" TEXT,
    "engineMatchType" "EngineMatchType",
    "fuelType" TEXT,
    "transmission" TEXT,
    "variantNotes" TEXT,
    "sourceDocumentId" TEXT,
    "sourcePage" INTEGER,

    CONSTRAINT "CaseApplicability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseFaultCode" (
    "id" TEXT NOT NULL,
    "technicalCaseId" TEXT NOT NULL,
    "rawCode" TEXT NOT NULL,
    "normalizedCode" TEXT,
    "manufacturerCode" TEXT,
    "description" TEXT,
    "role" "FaultCodeRole" NOT NULL DEFAULT 'PRIMARY',
    "controlModule" TEXT,
    "sourceDocumentId" TEXT,
    "sourcePage" INTEGER,

    CONSTRAINT "CaseFaultCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseSymptom" (
    "id" TEXT NOT NULL,
    "technicalCaseId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "normalizedLabel" TEXT,
    "details" TEXT,
    "operatingCondition" TEXT,
    "sourceDocumentId" TEXT,
    "sourcePage" INTEGER,

    CONSTRAINT "CaseSymptom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseComponent" (
    "id" TEXT NOT NULL,
    "technicalCaseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT,
    "manufacturerIdentifier" TEXT,
    "system" TEXT,
    "role" TEXT,
    "sourceDocumentId" TEXT,
    "sourcePage" INTEGER,

    CONSTRAINT "CaseComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseCause" (
    "id" TEXT NOT NULL,
    "technicalCaseId" TEXT NOT NULL,
    "componentId" TEXT,
    "description" TEXT NOT NULL,
    "category" TEXT,
    "certainty" "CauseCertainty" NOT NULL DEFAULT 'POSSIBLE',
    "priority" INTEGER,
    "conditionText" TEXT,
    "sourceDocumentId" TEXT,
    "sourcePage" INTEGER,

    CONSTRAINT "CaseCause_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseSolution" (
    "id" TEXT NOT NULL,
    "technicalCaseId" TEXT NOT NULL,
    "componentId" TEXT,
    "type" "SolutionType" NOT NULL,
    "description" TEXT NOT NULL,
    "conditionText" TEXT,
    "priority" INTEGER,
    "sourceDocumentId" TEXT,
    "sourcePage" INTEGER,

    CONSTRAINT "CaseSolution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Procedure" (
    "id" TEXT NOT NULL,
    "technicalCaseId" TEXT NOT NULL,
    "type" "ProcedureType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "position" INTEGER NOT NULL,

    CONSTRAINT "Procedure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcedureStep" (
    "id" TEXT NOT NULL,
    "procedureId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "instruction" TEXT NOT NULL,
    "precondition" TEXT,
    "expectedResult" TEXT,
    "ifPass" TEXT,
    "ifFail" TEXT,
    "toolsText" TEXT,
    "componentId" TEXT,
    "applicabilityId" TEXT,
    "sourceDocumentId" TEXT,
    "sourcePage" INTEGER,

    CONSTRAINT "ProcedureStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeasurementSpec" (
    "id" TEXT NOT NULL,
    "technicalCaseId" TEXT NOT NULL,
    "procedureStepId" TEXT,
    "componentId" TEXT,
    "applicabilityId" TEXT,
    "parameter" TEXT NOT NULL,
    "measurementType" TEXT,
    "targetValue" DECIMAL(18,6),
    "minValue" DECIMAL(18,6),
    "maxValue" DECIMAL(18,6),
    "tolerancePlus" DECIMAL(18,6),
    "toleranceMinus" DECIMAL(18,6),
    "unit" TEXT,
    "expectedText" TEXT,
    "conditionText" TEXT,
    "durationSeconds" INTEGER,
    "repeatCount" INTEGER,
    "isApproximate" BOOLEAN NOT NULL DEFAULT false,
    "isExample" BOOLEAN NOT NULL DEFAULT false,
    "sourceDocumentId" TEXT,
    "sourcePage" INTEGER,

    CONSTRAINT "MeasurementSpec_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseNote" (
    "id" TEXT NOT NULL,
    "technicalCaseId" TEXT NOT NULL,
    "procedureStepId" TEXT,
    "applicabilityId" TEXT,
    "type" "NoteType" NOT NULL,
    "text" TEXT NOT NULL,
    "externalReference" TEXT,
    "sourceDocumentId" TEXT,
    "sourcePage" INTEGER,

    CONSTRAINT "CaseNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CasePart" (
    "id" TEXT NOT NULL,
    "technicalCaseId" TEXT NOT NULL,
    "componentId" TEXT,
    "applicabilityId" TEXT,
    "partNumber" TEXT NOT NULL,
    "description" TEXT,
    "role" TEXT,
    "vinVerificationRequired" BOOLEAN NOT NULL DEFAULT false,
    "sourceDocumentId" TEXT,
    "sourcePage" INTEGER,

    CONSTRAINT "CasePart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceMedia" (
    "id" TEXT NOT NULL,
    "sourceDocumentId" TEXT NOT NULL,
    "technicalCaseId" TEXT,
    "sourcePage" INTEGER NOT NULL,
    "type" "MediaType" NOT NULL,
    "storagePath" TEXT NOT NULL,
    "caption" TEXT,
    "technicalDescription" TEXT,
    "componentId" TEXT,
    "procedureStepId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceMedia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SourceDocument_storagePath_key" ON "SourceDocument"("storagePath");

-- CreateIndex
CREATE UNIQUE INDEX "SourceDocument_sha256_key" ON "SourceDocument"("sha256");

-- CreateIndex
CREATE INDEX "SourceDocument_processingStatus_idx" ON "SourceDocument"("processingStatus");

-- CreateIndex
CREATE INDEX "IngestionRun_sourceDocumentId_idx" ON "IngestionRun"("sourceDocumentId");

-- CreateIndex
CREATE INDEX "IngestionRun_status_idx" ON "IngestionRun"("status");

-- CreateIndex
CREATE INDEX "TechnicalCase_validationStatus_idx" ON "TechnicalCase"("validationStatus");

-- CreateIndex
CREATE INDEX "CaseSource_sourceDocumentId_idx" ON "CaseSource"("sourceDocumentId");

-- CreateIndex
CREATE UNIQUE INDEX "CaseSource_technicalCaseId_sourceDocumentId_key" ON "CaseSource"("technicalCaseId", "sourceDocumentId");

-- CreateIndex
CREATE INDEX "CaseApplicability_technicalCaseId_idx" ON "CaseApplicability"("technicalCaseId");

-- CreateIndex
CREATE INDEX "CaseApplicability_brand_idx" ON "CaseApplicability"("brand");

-- CreateIndex
CREATE INDEX "CaseApplicability_model_idx" ON "CaseApplicability"("model");

-- CreateIndex
CREATE INDEX "CaseApplicability_engineCode_idx" ON "CaseApplicability"("engineCode");

-- CreateIndex
CREATE INDEX "CaseApplicability_engineFamily_idx" ON "CaseApplicability"("engineFamily");

-- CreateIndex
CREATE INDEX "CaseApplicability_sourceDocumentId_sourcePage_idx" ON "CaseApplicability"("sourceDocumentId", "sourcePage");

-- CreateIndex
CREATE INDEX "CaseFaultCode_technicalCaseId_idx" ON "CaseFaultCode"("technicalCaseId");

-- CreateIndex
CREATE INDEX "CaseFaultCode_normalizedCode_idx" ON "CaseFaultCode"("normalizedCode");

-- CreateIndex
CREATE INDEX "CaseFaultCode_sourceDocumentId_sourcePage_idx" ON "CaseFaultCode"("sourceDocumentId", "sourcePage");

-- CreateIndex
CREATE INDEX "CaseSymptom_technicalCaseId_idx" ON "CaseSymptom"("technicalCaseId");

-- CreateIndex
CREATE INDEX "CaseSymptom_normalizedLabel_idx" ON "CaseSymptom"("normalizedLabel");

-- CreateIndex
CREATE INDEX "CaseSymptom_sourceDocumentId_sourcePage_idx" ON "CaseSymptom"("sourceDocumentId", "sourcePage");

-- CreateIndex
CREATE INDEX "CaseComponent_technicalCaseId_idx" ON "CaseComponent"("technicalCaseId");

-- CreateIndex
CREATE INDEX "CaseComponent_normalizedName_idx" ON "CaseComponent"("normalizedName");

-- CreateIndex
CREATE INDEX "CaseComponent_sourceDocumentId_sourcePage_idx" ON "CaseComponent"("sourceDocumentId", "sourcePage");

-- CreateIndex
CREATE INDEX "CaseCause_technicalCaseId_idx" ON "CaseCause"("technicalCaseId");

-- CreateIndex
CREATE INDEX "CaseCause_componentId_idx" ON "CaseCause"("componentId");

-- CreateIndex
CREATE INDEX "CaseCause_sourceDocumentId_sourcePage_idx" ON "CaseCause"("sourceDocumentId", "sourcePage");

-- CreateIndex
CREATE INDEX "CaseSolution_technicalCaseId_idx" ON "CaseSolution"("technicalCaseId");

-- CreateIndex
CREATE INDEX "CaseSolution_componentId_idx" ON "CaseSolution"("componentId");

-- CreateIndex
CREATE INDEX "CaseSolution_sourceDocumentId_sourcePage_idx" ON "CaseSolution"("sourceDocumentId", "sourcePage");

-- CreateIndex
CREATE UNIQUE INDEX "Procedure_technicalCaseId_position_key" ON "Procedure"("technicalCaseId", "position");

-- CreateIndex
CREATE INDEX "ProcedureStep_componentId_idx" ON "ProcedureStep"("componentId");

-- CreateIndex
CREATE INDEX "ProcedureStep_applicabilityId_idx" ON "ProcedureStep"("applicabilityId");

-- CreateIndex
CREATE INDEX "ProcedureStep_sourceDocumentId_sourcePage_idx" ON "ProcedureStep"("sourceDocumentId", "sourcePage");

-- CreateIndex
CREATE UNIQUE INDEX "ProcedureStep_procedureId_position_key" ON "ProcedureStep"("procedureId", "position");

-- CreateIndex
CREATE INDEX "MeasurementSpec_technicalCaseId_idx" ON "MeasurementSpec"("technicalCaseId");

-- CreateIndex
CREATE INDEX "MeasurementSpec_procedureStepId_idx" ON "MeasurementSpec"("procedureStepId");

-- CreateIndex
CREATE INDEX "MeasurementSpec_componentId_idx" ON "MeasurementSpec"("componentId");

-- CreateIndex
CREATE INDEX "MeasurementSpec_applicabilityId_idx" ON "MeasurementSpec"("applicabilityId");

-- CreateIndex
CREATE INDEX "MeasurementSpec_sourceDocumentId_sourcePage_idx" ON "MeasurementSpec"("sourceDocumentId", "sourcePage");

-- CreateIndex
CREATE INDEX "CaseNote_technicalCaseId_idx" ON "CaseNote"("technicalCaseId");

-- CreateIndex
CREATE INDEX "CaseNote_procedureStepId_idx" ON "CaseNote"("procedureStepId");

-- CreateIndex
CREATE INDEX "CaseNote_applicabilityId_idx" ON "CaseNote"("applicabilityId");

-- CreateIndex
CREATE INDEX "CaseNote_sourceDocumentId_sourcePage_idx" ON "CaseNote"("sourceDocumentId", "sourcePage");

-- CreateIndex
CREATE INDEX "CasePart_technicalCaseId_idx" ON "CasePart"("technicalCaseId");

-- CreateIndex
CREATE INDEX "CasePart_componentId_idx" ON "CasePart"("componentId");

-- CreateIndex
CREATE INDEX "CasePart_applicabilityId_idx" ON "CasePart"("applicabilityId");

-- CreateIndex
CREATE INDEX "CasePart_partNumber_idx" ON "CasePart"("partNumber");

-- CreateIndex
CREATE INDEX "CasePart_sourceDocumentId_sourcePage_idx" ON "CasePart"("sourceDocumentId", "sourcePage");

-- CreateIndex
CREATE INDEX "SourceMedia_technicalCaseId_idx" ON "SourceMedia"("technicalCaseId");

-- CreateIndex
CREATE INDEX "SourceMedia_componentId_idx" ON "SourceMedia"("componentId");

-- CreateIndex
CREATE INDEX "SourceMedia_procedureStepId_idx" ON "SourceMedia"("procedureStepId");

-- CreateIndex
CREATE INDEX "SourceMedia_sourceDocumentId_sourcePage_idx" ON "SourceMedia"("sourceDocumentId", "sourcePage");

-- CreateIndex
CREATE UNIQUE INDEX "SourceMedia_sourceDocumentId_storagePath_key" ON "SourceMedia"("sourceDocumentId", "storagePath");

-- AddForeignKey
ALTER TABLE "IngestionRun" ADD CONSTRAINT "IngestionRun_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "SourceDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseSource" ADD CONSTRAINT "CaseSource_technicalCaseId_fkey" FOREIGN KEY ("technicalCaseId") REFERENCES "TechnicalCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseSource" ADD CONSTRAINT "CaseSource_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "SourceDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseApplicability" ADD CONSTRAINT "CaseApplicability_technicalCaseId_fkey" FOREIGN KEY ("technicalCaseId") REFERENCES "TechnicalCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseApplicability" ADD CONSTRAINT "CaseApplicability_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "SourceDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseFaultCode" ADD CONSTRAINT "CaseFaultCode_technicalCaseId_fkey" FOREIGN KEY ("technicalCaseId") REFERENCES "TechnicalCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseFaultCode" ADD CONSTRAINT "CaseFaultCode_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "SourceDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseSymptom" ADD CONSTRAINT "CaseSymptom_technicalCaseId_fkey" FOREIGN KEY ("technicalCaseId") REFERENCES "TechnicalCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseSymptom" ADD CONSTRAINT "CaseSymptom_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "SourceDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseComponent" ADD CONSTRAINT "CaseComponent_technicalCaseId_fkey" FOREIGN KEY ("technicalCaseId") REFERENCES "TechnicalCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseComponent" ADD CONSTRAINT "CaseComponent_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "SourceDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseCause" ADD CONSTRAINT "CaseCause_technicalCaseId_fkey" FOREIGN KEY ("technicalCaseId") REFERENCES "TechnicalCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseCause" ADD CONSTRAINT "CaseCause_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "CaseComponent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseCause" ADD CONSTRAINT "CaseCause_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "SourceDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseSolution" ADD CONSTRAINT "CaseSolution_technicalCaseId_fkey" FOREIGN KEY ("technicalCaseId") REFERENCES "TechnicalCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseSolution" ADD CONSTRAINT "CaseSolution_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "CaseComponent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseSolution" ADD CONSTRAINT "CaseSolution_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "SourceDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Procedure" ADD CONSTRAINT "Procedure_technicalCaseId_fkey" FOREIGN KEY ("technicalCaseId") REFERENCES "TechnicalCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcedureStep" ADD CONSTRAINT "ProcedureStep_procedureId_fkey" FOREIGN KEY ("procedureId") REFERENCES "Procedure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcedureStep" ADD CONSTRAINT "ProcedureStep_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "CaseComponent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcedureStep" ADD CONSTRAINT "ProcedureStep_applicabilityId_fkey" FOREIGN KEY ("applicabilityId") REFERENCES "CaseApplicability"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcedureStep" ADD CONSTRAINT "ProcedureStep_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "SourceDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeasurementSpec" ADD CONSTRAINT "MeasurementSpec_technicalCaseId_fkey" FOREIGN KEY ("technicalCaseId") REFERENCES "TechnicalCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeasurementSpec" ADD CONSTRAINT "MeasurementSpec_procedureStepId_fkey" FOREIGN KEY ("procedureStepId") REFERENCES "ProcedureStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeasurementSpec" ADD CONSTRAINT "MeasurementSpec_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "CaseComponent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeasurementSpec" ADD CONSTRAINT "MeasurementSpec_applicabilityId_fkey" FOREIGN KEY ("applicabilityId") REFERENCES "CaseApplicability"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeasurementSpec" ADD CONSTRAINT "MeasurementSpec_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "SourceDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseNote" ADD CONSTRAINT "CaseNote_technicalCaseId_fkey" FOREIGN KEY ("technicalCaseId") REFERENCES "TechnicalCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseNote" ADD CONSTRAINT "CaseNote_procedureStepId_fkey" FOREIGN KEY ("procedureStepId") REFERENCES "ProcedureStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseNote" ADD CONSTRAINT "CaseNote_applicabilityId_fkey" FOREIGN KEY ("applicabilityId") REFERENCES "CaseApplicability"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseNote" ADD CONSTRAINT "CaseNote_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "SourceDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CasePart" ADD CONSTRAINT "CasePart_technicalCaseId_fkey" FOREIGN KEY ("technicalCaseId") REFERENCES "TechnicalCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CasePart" ADD CONSTRAINT "CasePart_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "CaseComponent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CasePart" ADD CONSTRAINT "CasePart_applicabilityId_fkey" FOREIGN KEY ("applicabilityId") REFERENCES "CaseApplicability"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CasePart" ADD CONSTRAINT "CasePart_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "SourceDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceMedia" ADD CONSTRAINT "SourceMedia_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "SourceDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceMedia" ADD CONSTRAINT "SourceMedia_technicalCaseId_fkey" FOREIGN KEY ("technicalCaseId") REFERENCES "TechnicalCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceMedia" ADD CONSTRAINT "SourceMedia_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "CaseComponent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceMedia" ADD CONSTRAINT "SourceMedia_procedureStepId_fkey" FOREIGN KEY ("procedureStepId") REFERENCES "ProcedureStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;
