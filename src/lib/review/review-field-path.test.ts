import assert from "node:assert/strict";
import test from "node:test";

import {
  reviewFieldId,
  reviewNodeId,
  validationTargetIds,
} from "./review-field-path";

test("creates stable field IDs from import validation paths", () => {
  assert.equal(
    reviewFieldId("cases[0].causes[0].componentReference"),
    "review-field-cases%5B0%5D.causes%5B0%5D.componentReference",
  );
});

test("falls back from a field to its containing review item", () => {
  const ids = validationTargetIds("cases[0].causes[0].componentReference");
  assert.deepEqual(ids.slice(0, 4), [
    reviewFieldId("cases[0].causes[0].componentReference"),
    reviewNodeId("cases[0].causes[0].componentReference"),
    reviewFieldId("cases[0].causes[0]"),
    reviewNodeId("cases[0].causes[0]"),
  ]);
});
