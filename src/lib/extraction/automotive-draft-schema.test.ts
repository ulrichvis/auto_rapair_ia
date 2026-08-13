import assert from "node:assert/strict";
import test from "node:test";
import { zodTextFormat } from "openai/helpers/zod";

import {
  automotiveExtractionDraftSchema,
  validateAutomotiveExtractionDraft,
} from "./automotive-draft-schema";
import { createValidDraft } from "./test-fixtures";

test("accepts a valid structured automotive extraction draft", () => {
  const draft = createValidDraft();

  assert.deepEqual(validateAutomotiveExtractionDraft(draft), draft);
});

test("rejects an invalid extraction response", () => {
  const draft = createValidDraft();
  const invalidDraft = {
    ...draft,
    cases: [{ ...draft.cases[0], faultCodes: [{ rawCode: "P0299" }] }],
  };

  assert.throws(() => validateAutomotiveExtractionDraft(invalidDraft));
});

test("produces a strict Structured Outputs JSON schema", () => {
  const format = zodTextFormat(
    automotiveExtractionDraftSchema,
    "automotive_technical_draft",
  );

  assert.equal(format.type, "json_schema");
  assert.equal(format.strict, true);
  assert.deepEqual(format.schema.required, ["document", "cases"]);
});
