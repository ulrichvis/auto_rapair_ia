import assert from "node:assert/strict";
import test from "node:test";

import {
  assertImportableRun,
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
      assertImportableRun(
        {
          id: "run-1",
          sourceDocumentId: "document-1",
          status: "SUCCESS",
          hasRawOutput: true,
          reviewedAt: new Date(),
          importedAt: new Date(),
        },
        "document-1",
        "run-1",
      ),
    (error) =>
      error instanceof ImportStateError && error.code === "ALREADY_IMPORTED",
  );
});

test("rejects a successful extraction that was never human-reviewed", () => {
  assert.throws(
    () =>
      assertImportableRun(
        {
          id: "run-1",
          sourceDocumentId: "document-1",
          status: "SUCCESS",
          hasRawOutput: true,
          reviewedAt: null,
          importedAt: null,
        },
        "document-1",
        "run-1",
      ),
    (error) =>
      error instanceof ImportStateError && error.code === "NOT_REVIEWED",
  );
});
