import assert from "node:assert/strict";
import test from "node:test";

import english from "./messages/en.json";
import italian from "./messages/it.json";

function messageKeys(value: unknown, prefix = ""): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [prefix];
  }

  return Object.entries(value).flatMap(([key, nestedValue]) =>
    messageKeys(nestedValue, prefix ? `${prefix}.${key}` : key),
  );
}

test("English and Italian message catalogs contain the same keys", () => {
  assert.deepEqual(messageKeys(italian).sort(), messageKeys(english).sort());
});
