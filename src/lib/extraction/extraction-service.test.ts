import assert from "node:assert/strict";
import test from "node:test";

import type { ExtractionProvider } from "./extraction-provider";
import {
  createExtractionService,
  type ExtractionDocument,
  type ExtractionRepository,
  type SuccessfulExtraction,
} from "./extraction-service";
import { createValidDraft } from "./test-fixtures";
import type { PdfProcessingMetadata } from "./pdf-processing";

class MemoryRepository implements ExtractionRepository {
  document: ExtractionDocument = {
    id: "document-1",
    originalFilename: "source.pdf",
    storagePath: "ab/hash.pdf",
    processingStatus: "PENDING",
  };

  completedResult: SuccessfulExtraction | null = null;
  failedMessage: string | null = null;
  processingMetadata: PdfProcessingMetadata | null = null;
  importCalls: Array<{ documentId: string; runId: string }> = [];

  async findDocument(documentId: string) {
    return documentId === this.document.id ? this.document : null;
  }

  async startRun() {
    this.document.processingStatus = "PROCESSING";
    return { runId: "run-1" };
  }

  async completeRun(
    _documentId: string,
    _runId: string,
    result: SuccessfulExtraction,
  ) {
    this.completedResult = result;
    this.document.processingStatus = "PROCESSING";
  }

  async recordProcessing(_runId: string, metadata: PdfProcessingMetadata) {
    this.processingMetadata = metadata;
  }

  async failRun(_documentId: string, _runId: string, message: string) {
    this.failedMessage = message;
    this.document.processingStatus = "FAILED";
  }

  async importKnowledge(documentId: string, runId: string) {
    this.importCalls.push({ documentId, runId });
    this.document.processingStatus = "COMPLETED";
    return { cases: [{ id: "case-1", title: "Caso importato" }] };
  }
}

function successfulProvider(): ExtractionProvider {
  return {
    async extractPdf() {
      return {
        draft: createValidDraft(),
        model: "gpt-5.6-luna",
        providerVersion: "test-provider",
        usage: {
          inputTokens: 120,
          outputTokens: 45,
          totalTokens: 165,
        },
      };
    },
  };
}

test("persists a successful structured draft and usage on the ingestion run", async () => {
  const repository = new MemoryRepository();
  const service = createExtractionService({
    repository,
    provider: successfulProvider(),
    async loadPdf() {
      return Buffer.from("%PDF-test");
    },
    importKnowledge: repository.importKnowledge.bind(repository),
  });

  const result = await service.extractDocument(repository.document.id);

  assert.equal(result.status, "IMPORTED");
  assert.equal(repository.document.processingStatus, "COMPLETED");
  assert.deepEqual(repository.importCalls, [
    { documentId: "document-1", runId: "run-1" },
  ]);
  assert.equal(repository.completedResult?.model, "gpt-5.6-luna");
  assert.equal(repository.completedResult?.totalTokens, 165);
  assert.deepEqual(repository.completedResult?.draft, createValidDraft());
  assert.equal(repository.failedMessage, null);
  assert.deepEqual(repository.processingMetadata, {
    originalFileSizeBytes: 9,
    processingFileSizeBytes: 9,
    processingWasOptimized: false,
    processingWarning: null,
  });
});

test("sends an optimized processing copy to extraction and cleans it up", async () => {
  const repository = new MemoryRepository();
  const original = Buffer.from("%PDF-original");
  const optimized = Buffer.from("%PDF-small");
  let received: Buffer | null = null;
  let cleaned = false;
  const provider: ExtractionProvider = {
    async extractPdf(input) {
      received = input.pdf;
      return successfulProvider().extractPdf(input);
    },
  };
  const service = createExtractionService({
    repository,
    provider,
    async loadPdf() {
      return original;
    },
    async preparePdf() {
      return {
        pdf: optimized,
        metadata: {
          originalFileSizeBytes: original.length,
          processingFileSizeBytes: optimized.length,
          processingWasOptimized: true,
          processingWarning: null,
        },
        async cleanup() {
          cleaned = true;
        },
      };
    },
    importKnowledge: repository.importKnowledge.bind(repository),
  });

  await service.extractDocument(repository.document.id);

  assert.strictEqual(received, optimized);
  assert.equal(cleaned, true);
  assert.equal(repository.processingMetadata?.processingWasOptimized, true);
});

test("persists failure state when the extraction API request fails", async () => {
  const repository = new MemoryRepository();
  const provider: ExtractionProvider = {
    async extractPdf() {
      throw new Error("OpenAI request failed");
    },
  };
  const service = createExtractionService({
    repository,
    provider,
    async loadPdf() {
      return Buffer.from("%PDF-test");
    },
    importKnowledge: repository.importKnowledge.bind(repository),
  });

  await assert.rejects(
    service.extractDocument(repository.document.id),
    /OpenAI request failed/,
  );
  assert.equal(repository.document.processingStatus, "FAILED");
  assert.equal(repository.failedMessage, "OpenAI request failed");
  assert.equal(repository.completedResult, null);
});

test("preserves the extracted draft and marks failure when automatic import fails", async () => {
  const repository = new MemoryRepository();
  const service = createExtractionService({
    repository,
    provider: successfulProvider(),
    async loadPdf() {
      return Buffer.from("%PDF-test");
    },
    async importKnowledge() {
      throw new Error("Structural import validation failed");
    },
  });

  await assert.rejects(
    service.extractDocument(repository.document.id),
    /Structural import validation failed/,
  );
  assert.deepEqual(repository.completedResult?.draft, createValidDraft());
  assert.equal(repository.document.processingStatus, "FAILED");
  assert.equal(repository.failedMessage, "Structural import validation failed");
});
