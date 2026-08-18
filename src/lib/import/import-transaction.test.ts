import assert from "node:assert/strict";
import test from "node:test";

import {
  assertAutomaticallyImportableRun,
  buildHumanReviewRunUpdate,
  buildTechnicalCaseLifecycle,
  ImportStateError,
  runAtomicImport,
} from "./import-transaction";

test("commits a complete successful relational import", async () => {
  let committed: string[] = [];
  const database = {
    async $transaction<T>(work: (transaction: string[]) => Promise<T>) {
      const staged = [...committed];
      const result = await work(staged);
      committed = staged;
      return result;
    },
  };
  const entities = [
    "TechnicalCase",
    "CaseSource",
    "CaseApplicability",
    "CaseFaultCode",
    "CaseSymptom",
    "CaseComponent",
    "CaseCause",
    "CaseSolution",
    "Procedure",
    "ProcedureStep",
    "MeasurementSpec",
    "CaseNote",
    "CasePart",
  ];

  const result = await runAtomicImport(database, async (transaction) => {
    transaction.push(...entities);
    return { caseIds: ["case-1"] };
  });

  assert.deepEqual(committed, entities);
  assert.deepEqual(result, { caseIds: ["case-1"] });
});

test("rolls back all staged writes when import persistence fails", async () => {
  let committed: string[] = [];
  const database = {
    async $transaction<T>(work: (transaction: string[]) => Promise<T>) {
      const staged = [...committed];
      const result = await work(staged);
      committed = staged;
      return result;
    },
  };

  await assert.rejects(
    runAtomicImport(database, async (transaction) => {
      transaction.push("TechnicalCase", "CaseSource");
      throw new Error("simulated persistence failure");
    }),
  );
  assert.deepEqual(committed, []);
});

test("rejects a duplicate import attempt", () => {
  assert.throws(
    () =>
      assertAutomaticallyImportableRun(
        {
          id: "run-1",
          sourceDocumentId: "document-1",
          status: "IMPORTED",
          hasRawOutput: true,
          importedAt: new Date(),
        },
        "document-1",
        "run-1",
      ),
    (error) =>
      error instanceof ImportStateError && error.code === "ALREADY_IMPORTED",
  );
});

test("allows an extracted run to import without human review", () => {
  assert.doesNotThrow(() =>
    assertAutomaticallyImportableRun(
      {
        id: "run-1",
        sourceDocumentId: "document-1",
        status: "IMPORTING",
        hasRawOutput: true,
        importedAt: null,
      },
      "document-1",
      "run-1",
    ),
  );
});

test("marks automatic and human-reviewed cases with distinct provenance", () => {
  const now = new Date("2026-08-18T12:00:00.000Z");

  assert.deepEqual(buildTechnicalCaseLifecycle("automatic", false, now), {
    validationStatus: "IN_REVIEW",
    validatedAt: null,
    importedAutomatically: true,
    reviewedByHuman: false,
    reviewedAt: null,
  });
  assert.deepEqual(buildTechnicalCaseLifecycle("human-review", true, now), {
    validationStatus: "VALIDATED",
    validatedAt: now,
    importedAutomatically: true,
    reviewedByHuman: true,
    reviewedAt: now,
  });
});

test("human review persistence never overwrites the extraction snapshot", () => {
  const update = buildHumanReviewRunUpdate(
    { document: { language: "it" } },
    new Date("2026-08-18T12:00:00.000Z"),
  );

  assert.equal("rawOutput" in update, false);
  assert.deepEqual(update.reviewedOutput, { document: { language: "it" } });
});
