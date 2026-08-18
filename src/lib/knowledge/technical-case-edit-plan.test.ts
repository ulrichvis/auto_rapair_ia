import assert from "node:assert/strict";
import test from "node:test";

import { createValidDraft } from "../extraction/test-fixtures";
import { KnowledgeImportValidationError } from "../import/knowledge-import-plan";
import {
  buildManualEditLifecycle,
  buildTechnicalCaseEditPlan,
  runAtomicCaseEdit,
} from "./technical-case-edit-plan";

test("prepares one Italian technical case without translating its content", () => {
  const draft = createValidDraft();
  const plan = buildTechnicalCaseEditPlan(draft, 2);

  assert.equal(plan.draft.document.language, "it");
  assert.equal(
    plan.draft.cases[0].title,
    "Pressione di sovralimentazione insufficiente",
  );
  assert.equal(plan.draft.cases[0].faultCodes[0].rawCode, "P0299");
});

test("rejects an invalid edit before transactional persistence", () => {
  const draft = createValidDraft();
  draft.cases[0].applicability.push({
    reference: "invalid-years",
    brand: "Ford",
    model: null,
    generationOrPlatform: null,
    yearFrom: 2020,
    yearTo: 2010,
    engineLabel: null,
    engineFamily: null,
    engineCode: null,
    engineCodePattern: null,
    engineMatchType: null,
    fuelType: null,
    transmission: null,
    variantNotes: null,
    sourcePage: 1,
  });

  assert.throws(
    () => buildTechnicalCaseEditPlan(draft, 2),
    (error) =>
      error instanceof KnowledgeImportValidationError &&
      error.issues.some((issue) => issue.code === "INVALID_YEAR_RANGE"),
  );
});

test("rejects a meaningless empty applicability record", () => {
  const draft = createValidDraft();
  draft.cases[0].applicability.push({
    reference: null,
    brand: null,
    model: null,
    generationOrPlatform: null,
    yearFrom: null,
    yearTo: null,
    engineLabel: null,
    engineFamily: null,
    engineCode: null,
    engineCodePattern: null,
    engineMatchType: null,
    fuelType: null,
    transmission: null,
    variantNotes: null,
    sourcePage: null,
  });

  assert.throws(
    () => buildTechnicalCaseEditPlan(draft, 2),
    (error) =>
      error instanceof KnowledgeImportValidationError &&
      error.issues.some((issue) => issue.code === "EMPTY_APPLICABILITY"),
  );
});

test("commits successful edits atomically and preserves the extraction snapshot", async () => {
  let state = {
    title: "Titolo originale",
    rawOutput: { title: "Snapshot originale" },
  };

  const database = {
    async $transaction(
      work: (transaction: typeof state) => Promise<typeof state>,
    ) {
      const staged = structuredClone(state);
      const result = await work(staged);
      state = staged;
      return result;
    },
  };

  await runAtomicCaseEdit(database, async (transaction) => {
    transaction.title = "Titolo corretto";
    return transaction;
  });

  assert.equal(state.title, "Titolo corretto");
  assert.deepEqual(state.rawOutput, { title: "Snapshot originale" });
});

test("a failed transactional edit leaves existing data unchanged", async () => {
  let state = { title: "Titolo originale" };
  const database = {
    async $transaction(
      work: (transaction: typeof state) => Promise<typeof state>,
    ) {
      const staged = structuredClone(state);
      const result = await work(staged);
      state = staged;
      return result;
    },
  };

  await assert.rejects(
    runAtomicCaseEdit(database, async (transaction) => {
      transaction.title = "Titolo non valido";
      throw new Error("persistence failed");
    }),
    /persistence failed/,
  );

  assert.equal(state.title, "Titolo originale");
});

test("manual editing uses the existing human-review provenance", () => {
  const now = new Date("2026-08-18T12:00:00.000Z");
  assert.deepEqual(buildManualEditLifecycle(now), {
    validationStatus: "VALIDATED",
    validatedAt: now,
    reviewedByHuman: true,
    reviewedAt: now,
  });
});
