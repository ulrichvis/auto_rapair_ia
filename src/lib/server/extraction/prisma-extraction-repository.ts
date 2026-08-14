import "server-only";

import { Prisma } from "@/generated/prisma/client";
import type {
  ExtractionRepository,
  SuccessfulExtraction,
} from "@/lib/extraction/extraction-service";
import { ExtractionConflictError } from "@/lib/extraction/extraction-service";
import { prisma } from "@/lib/server/prisma";

function toJsonValue(draft: SuccessfulExtraction["draft"]) {
  return JSON.parse(JSON.stringify(draft)) as Prisma.InputJsonValue;
}

export const prismaExtractionRepository: ExtractionRepository = {
  findDocument(documentId) {
    return prisma.sourceDocument.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        originalFilename: true,
        storagePath: true,
        processingStatus: true,
      },
    });
  },

  async startRun(documentId) {
    return prisma.$transaction(async (transaction) => {
      const updated = await transaction.sourceDocument.updateMany({
        where: {
          id: documentId,
          processingStatus: { not: "PROCESSING" },
        },
        data: { processingStatus: "PROCESSING" },
      });

      if (updated.count !== 1) {
        throw new ExtractionConflictError(
          "This document is already being extracted.",
        );
      }

      const run = await transaction.ingestionRun.create({
        data: {
          sourceDocumentId: documentId,
          status: "PROCESSING",
          extractor: "openai",
        },
        select: { id: true },
      });

      return { runId: run.id };
    });
  },

  async completeRun(documentId, runId, result) {
    await prisma.$transaction(async (transaction) => {
      await transaction.ingestionRun.update({
        where: { id: runId },
        data: {
          status: "SUCCESS",
          extractorVersion: result.providerVersion,
          model: result.model,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          totalTokens: result.totalTokens,
          rawOutput: toJsonValue(result.draft),
          errorMessage: null,
          completedAt: new Date(),
        },
      });
      await transaction.sourceDocument.update({
        where: { id: documentId },
        data: { processingStatus: "REVIEW_REQUIRED" },
      });

      const detectedLanguage = result.draft.document.language;

      if (detectedLanguage) {
        await transaction.sourceDocument.updateMany({
          where: { id: documentId, language: null },
          data: { language: detectedLanguage },
        });
      }
    });
  },

  async recordProcessing(runId, metadata) {
    await prisma.ingestionRun.update({
      where: { id: runId },
      data: metadata,
    });
  },

  async failRun(documentId, runId, message) {
    await prisma.$transaction([
      prisma.ingestionRun.update({
        where: { id: runId },
        data: {
          status: "FAILED",
          errorMessage: message,
          completedAt: new Date(),
        },
      }),
      prisma.sourceDocument.update({
        where: { id: documentId },
        data: { processingStatus: "FAILED" },
      }),
    ]);
  },
};
