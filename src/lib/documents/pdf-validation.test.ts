import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_PDF_SIZE_BYTES,
  PdfValidationError,
  validatePdfMetadata,
  validatePdfSignature,
} from "./pdf-validation";

test("accepts a PDF below the 15 MiB limit", () => {
  assert.equal(
    validatePdfMetadata({
      name: "technical.pdf",
      type: "application/pdf",
      size: MAX_PDF_SIZE_BYTES - 1,
    }),
    "technical.pdf",
  );
});

test("rejects a PDF above the 15 MiB limit", () => {
  assert.throws(
    () =>
      validatePdfMetadata({
        name: "technical.pdf",
        type: "application/pdf",
        size: MAX_PDF_SIZE_BYTES + 1,
      }),
    (error) =>
      error instanceof PdfValidationError && error.code === "TOO_LARGE",
  );
});

test("rejects a non-PDF file", () => {
  assert.throws(
    () =>
      validatePdfMetadata({
        name: "technical.txt",
        type: "text/plain",
        size: 100,
      }),
    (error) => error instanceof PdfValidationError && error.code === "NOT_PDF",
  );

  assert.throws(
    () => validatePdfSignature(new TextEncoder().encode("not a PDF")),
    (error) =>
      error instanceof PdfValidationError && error.code === "INVALID_PDF",
  );
});
