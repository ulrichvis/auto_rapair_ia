import {
  validateAutomotiveExtractionDraft,
  type AutomotiveExtractionDraft,
} from "./automotive-draft-schema";
import type {
  ExtractionProvider,
  ExtractionProviderResult,
} from "./extraction-provider";
import type { PdfProcessingMetadata, PreparedPdf } from "./pdf-processing";

export type ExtractionDocument = {
  id: string;
  originalFilename: string;
  storagePath: string;
  processingStatus: string;
};

export type SuccessfulExtraction = {
  draft: AutomotiveExtractionDraft;
  model: string;
  providerVersion: string;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
};

export interface ExtractionRepository {
  findDocument(documentId: string): Promise<ExtractionDocument | null>;
  startRun(documentId: string): Promise<{ runId: string }>;
  recordProcessing(
    runId: string,
    metadata: PdfProcessingMetadata,
  ): Promise<void>;
  completeRun(
    documentId: string,
    runId: string,
    result: SuccessfulExtraction,
  ): Promise<void>;
  failRun(documentId: string, runId: string, message: string): Promise<void>;
}

export type ExtractionServiceDependencies = {
  repository: ExtractionRepository;
  provider: ExtractionProvider;
  loadPdf(storagePath: string): Promise<Buffer>;
  preparePdf?(pdf: Buffer): Promise<PreparedPdf>;
  importKnowledge(
    documentId: string,
    runId: string,
  ): Promise<{ cases: Array<{ id: string; title: string }> }>;
};

export class ExtractionConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExtractionConflictError";
  }
}

function getSafeErrorMessage(error: unknown) {
  const message =
    error instanceof Error ? error.message : "Unexpected extraction failure.";

  return message.slice(0, 2_000);
}

function toSuccessfulExtraction(
  result: ExtractionProviderResult,
): SuccessfulExtraction {
  return {
    draft: validateAutomotiveExtractionDraft(result.draft),
    model: result.model,
    providerVersion: result.providerVersion,
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
    totalTokens: result.usage.totalTokens,
  };
}

export function createExtractionService({
  repository,
  provider,
  loadPdf,
  preparePdf,
  importKnowledge,
}: ExtractionServiceDependencies) {
  return {
    async extractDocument(documentId: string) {
      const document = await repository.findDocument(documentId);

      if (!document) {
        throw new Error("Source document not found.");
      }

      if (document.processingStatus === "PROCESSING") {
        throw new ExtractionConflictError(
          "This document is already being extracted.",
        );
      }

      const { runId } = await repository.startRun(document.id);

      try {
        const originalPdf = await loadPdf(document.storagePath);
        const prepared = preparePdf
          ? await preparePdf(originalPdf)
          : {
              pdf: originalPdf,
              metadata: {
                originalFileSizeBytes: originalPdf.length,
                processingFileSizeBytes: originalPdf.length,
                processingWasOptimized: false,
                processingWarning: null,
              },
              async cleanup() {},
            };

        try {
          await repository.recordProcessing(runId, prepared.metadata);
          const providerResult = await provider.extractPdf({
            filename: document.originalFilename,
            pdf: prepared.pdf,
          });
          const result = toSuccessfulExtraction(providerResult);

          await repository.completeRun(document.id, runId, result);
          const imported = await importKnowledge(document.id, runId);

          return {
            runId,
            status: "IMPORTED" as const,
            cases: imported.cases,
          };
        } finally {
          await prepared.cleanup().catch((cleanupError) => {
            const message =
              cleanupError instanceof Error
                ? cleanupError.message
                : "unknown cleanup failure";
            console.warn(`Temporary PDF cleanup failed: ${message}`);
          });
        }
      } catch (error) {
        await repository.failRun(
          document.id,
          runId,
          getSafeErrorMessage(error),
        );
        throw error;
      }
    },
  };
}
