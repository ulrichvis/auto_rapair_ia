import assert from "node:assert/strict";
import test from "node:test";

import { EXTRACTION_INSTRUCTIONS } from "./extraction-instructions";
import { validateAutomotiveExtractionDraft } from "./automotive-draft-schema";
import { createValidDraft } from "./test-fixtures";

test("preserves Italian source content, identifiers, normalized helpers, and language", () => {
  const draft = validateAutomotiveExtractionDraft(createValidDraft());
  const technicalCase = draft.cases[0];

  assert.equal(draft.document.language, "it");
  assert.equal(
    technicalCase.title,
    "Pressione di sovralimentazione insufficiente",
  );
  assert.equal(technicalCase.symptoms[0].label, "potenza motore ridotta");
  assert.equal(technicalCase.symptoms[0].normalizedLabel, "low_power");
  assert.equal(technicalCase.faultCodes[0].rawCode, "P0299");
  assert.equal(technicalCase.components[0].manufacturerIdentifier, "N75");
  assert.equal(technicalCase.components[0].name, "attuatore pressione turbo");
  assert.equal(technicalCase.components[0].normalizedName, "turbo_actuator");
});

test("prompt requires source-language extraction and never requests English translation", () => {
  assert.match(EXTRACTION_INSTRUCTIONS, /Detect the main language/);
  assert.match(
    EXTRACTION_INSTRUCTIONS,
    /Preserve all human-readable technical content in the original language/,
  );
  assert.match(EXTRACTION_INSTRUCTIONS, /Do not translate/);
  assert.match(EXTRACTION_INSTRUCTIONS, /P0299, 16683, G581, N75, V465/);
  assert.match(
    EXTRACTION_INSTRUCTIONS,
    /Use null when a normalized value is uncertain/,
  );
  assert.doesNotMatch(
    EXTRACTION_INSTRUCTIONS,
    /translate (?:the )?(?:content|fields|document|output) (?:to|into) English/i,
  );
});
