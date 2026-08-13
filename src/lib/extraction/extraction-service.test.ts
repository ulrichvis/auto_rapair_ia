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

class MemoryRepository implements ExtractionRepository {
  document: ExtractionDocument = {
    id: "document-1",
    originalFilename: "source.pdf",
    storagePath: "ab/hash.pdf",
    processingStatus: "PENDING",
  };

  completedResult: SuccessfulExtraction | null = null;
  failedMessage: string | null = null;

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
    this.document.processingStatus = "REVIEW_REQUIRED";
  }

  async failRun(_documentId: string, _runId: string, message: string) {
    this.failedMessage = message;
    this.document.processingStatus = "FAILED";
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
  });

  const result = await service.extractDocument(repository.document.id);

  assert.equal(result.status, "REVIEW_REQUIRED");
  assert.equal(repository.document.processingStatus, "REVIEW_REQUIRED");
  assert.equal(repository.completedResult?.model, "gpt-5.6-luna");
  assert.equal(repository.completedResult?.totalTokens, 165);
  assert.deepEqual(repository.completedResult?.draft, createValidDraft());
  assert.equal(repository.failedMessage, null);
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
  });

  await assert.rejects(
    service.extractDocument(repository.document.id),
    /OpenAI request failed/,
  );
  assert.equal(repository.document.processingStatus, "FAILED");
  assert.equal(repository.failedMessage, "OpenAI request failed");
  assert.equal(repository.completedResult, null);
});
