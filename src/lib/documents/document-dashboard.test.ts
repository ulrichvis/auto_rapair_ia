import assert from "node:assert/strict";
import test from "node:test";

import {
  createDocumentDashboardItem,
  documentDashboardQuery,
  filterDocumentDashboardItems,
  inferDocumentFailureStage,
  sanitizeDocumentError,
  summarizeDocumentDashboard,
  type DocumentDashboardInput,
} from "./document-dashboard";

function documentFixture(
  overrides: Partial<DocumentDashboardInput> = {},
): DocumentDashboardInput {
  return {
    id: "document-1",
    originalFilename: "bollettino.pdf",
    title: "Pressione di sovralimentazione insufficiente",
    bulletinReference: "TSB-001",
    language: "it",
    processingStatus: "PENDING",
    createdAt: new Date("2026-08-18T10:00:00.000Z"),
    ingestionRuns: [],
    caseSources: [],
    ...overrides,
  };
}

function runFixture(
  overrides: Partial<DocumentDashboardInput["ingestionRuns"][number]> = {},
): DocumentDashboardInput["ingestionRuns"][number] {
  return {
    id: "run-1",
    status: "PROCESSING",
    model: null,
    inputTokens: null,
    outputTokens: null,
    totalTokens: null,
    errorMessage: null,
    originalFileSizeBytes: null,
    processingFileSizeBytes: null,
    processingWasOptimized: null,
    processingWarning: null,
    startedAt: new Date("2026-08-18T10:01:00.000Z"),
    ...overrides,
  };
}

test("documents query displays newest uploads and only the latest ingestion run", () => {
  assert.deepEqual(documentDashboardQuery.orderBy, { createdAt: "desc" });
  assert.equal(documentDashboardQuery.select.ingestionRuns.take, 1);
  assert.deepEqual(documentDashboardQuery.select.ingestionRuns.orderBy, {
    startedAt: "desc",
  });
});

test("an uploaded document offers extraction", () => {
  const document = createDocumentDashboardItem(documentFixture());

  assert.equal(document.state, "UPLOADED");
  assert.deepEqual(document.actions, ["extract"]);
});

test("processing documents distinguish extraction from import and offer no duplicate action", () => {
  const extracting = createDocumentDashboardItem(
    documentFixture({
      processingStatus: "PROCESSING",
      ingestionRuns: [runFixture()],
    }),
  );
  const importing = createDocumentDashboardItem(
    documentFixture({
      processingStatus: "PROCESSING",
      ingestionRuns: [runFixture({ status: "IMPORTING" })],
    }),
  );

  assert.equal(extracting.state, "EXTRACTING");
  assert.equal(importing.state, "IMPORTING");
  assert.deepEqual(extracting.actions, []);
  assert.deepEqual(importing.actions, []);
});

test("a failed extraction offers retry and presents a safe technical error", () => {
  const latestRun = runFixture({
    status: "FAILED",
    originalFileSizeBytes: 2_000,
    errorMessage:
      "OpenAI request failed for sk-proj-secret at https://private.example/path",
  });
  const document = createDocumentDashboardItem(
    documentFixture({
      processingStatus: "FAILED",
      ingestionRuns: [latestRun],
    }),
  );

  assert.equal(document.state, "FAILED");
  assert.deepEqual(document.actions, ["retry"]);
  assert.equal(inferDocumentFailureStage(latestRun), "extraction");
  assert.equal(
    sanitizeDocumentError(latestRun.errorMessage!),
    "OpenAI request failed for [redacted key] at [redacted URL]",
  );
});

test("an imported PDF exposes every related case and manual-review provenance", () => {
  const sourceTitle = "Rigenerazione DPF troppo lunga";
  const document = createDocumentDashboardItem(
    documentFixture({
      title: sourceTitle,
      processingStatus: "COMPLETED",
      ingestionRuns: [
        runFixture({
          status: "IMPORTED",
          model: "gpt-test",
          inputTokens: 100,
          outputTokens: 20,
          totalTokens: 120,
        }),
      ],
      caseSources: [
        {
          technicalCase: {
            id: "case-1",
            title: "Caso DPF",
            reviewedByHuman: false,
          },
        },
        {
          technicalCase: {
            id: "case-2",
            title: "Controllo sensore",
            reviewedByHuman: true,
          },
        },
      ],
    }),
  );

  assert.equal(document.state, "IMPORTED");
  assert.equal(document.title, sourceTitle);
  assert.equal(document.latestRun?.model, "gpt-test");
  assert.deepEqual(
    document.technicalCases.map(({ id }) => id),
    ["case-1", "case-2"],
  );
  assert.equal(document.manuallyReviewed, true);
  assert.deepEqual(document.actions, ["openKnowledge", "editKnowledge"]);
});

test("dashboard filters and counts use the resolved workflow state", () => {
  const documents = [
    createDocumentDashboardItem(documentFixture({ id: "uploaded" })),
    createDocumentDashboardItem(
      documentFixture({
        id: "processing",
        processingStatus: "PROCESSING",
        ingestionRuns: [runFixture()],
      }),
    ),
    createDocumentDashboardItem(
      documentFixture({ id: "imported", processingStatus: "COMPLETED" }),
    ),
    createDocumentDashboardItem(
      documentFixture({ id: "failed", processingStatus: "FAILED" }),
    ),
  ];

  assert.equal(filterDocumentDashboardItems(documents, "processing").length, 1);
  assert.equal(filterDocumentDashboardItems(documents, "imported").length, 1);
  assert.deepEqual(summarizeDocumentDashboard(documents), {
    total: 4,
    processing: 1,
    imported: 1,
    failed: 1,
  });
});
