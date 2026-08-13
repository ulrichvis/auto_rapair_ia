import assert from "node:assert/strict";
import test from "node:test";

import { resolveLocale } from "./locale";

const italianTechnicalContent = {
  title: "Pressione di sovralimentazione insufficiente",
  dtc: "P0299",
  component: "N75",
};

test("Italian browser locales resolve to Italian", () => {
  assert.equal(resolveLocale(undefined, "it-IT,it;q=0.9,en;q=0.8"), "it");
});

test("English browser locales resolve to English", () => {
  assert.equal(resolveLocale(undefined, "en-GB,en;q=0.9"), "en");
});

test("unsupported browser locales fall back to English", () => {
  assert.equal(resolveLocale(undefined, "de-DE,de;q=0.9"), "en");
});

test("a valid stored language overrides browser detection", () => {
  assert.equal(resolveLocale("en", "it-IT,it;q=0.9"), "en");
  assert.equal(resolveLocale("it", "en-US,en;q=0.9"), "it");
});

test("an invalid stored language falls back to English", () => {
  assert.equal(resolveLocale("fr", "it-IT,it;q=0.9"), "en");
});

test("UI locale selection does not modify technical source content", () => {
  const before = structuredClone(italianTechnicalContent);

  resolveLocale("en", "it-IT");
  resolveLocale("it", "en-US");

  assert.deepEqual(italianTechnicalContent, before);
});
