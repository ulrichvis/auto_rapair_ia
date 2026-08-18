import assert from "node:assert/strict";
import test from "node:test";

import { MAX_PDF_SIZE_BYTES } from "./pdf-validation";
import {
  createPdfBatch,
  summarizePdfBatch,
  uploadPdfBatch,
} from "./pdf-upload-batch";

const validPdf = (name: string) => ({
  name,
  type: "application/pdf",
  size: 1_024,
});

test("uploads several valid PDFs independently", async () => {
  const uploaded: string[] = [];
  const result = await uploadPdfBatch(
    createPdfBatch([validPdf("one.pdf"), validPdf("two.pdf")]),
    async (file) => {
      uploaded.push(file.name);
      return { status: "uploaded" };
    },
  );

  assert.deepEqual(uploaded, ["one.pdf", "two.pdf"]);
  assert.equal(summarizePdfBatch(result).uploaded, 2);
});

test("an invalid PDF does not block valid files", async () => {
  const result = await uploadPdfBatch(
    createPdfBatch([
      validPdf("one.pdf"),
      { name: "notes.txt", type: "text/plain", size: 100 },
      validPdf("two.pdf"),
    ]),
    async () => ({ status: "uploaded" }),
  );

  assert.deepEqual(
    result.map((item) => item.state),
    ["uploaded", "invalid", "uploaded"],
  );
});

test("an oversized PDF does not block valid files", async () => {
  const result = await uploadPdfBatch(
    createPdfBatch([
      {
        name: "large.pdf",
        type: "application/pdf",
        size: MAX_PDF_SIZE_BYTES + 1,
      },
      validPdf("valid.pdf"),
    ]),
    async () => ({ status: "uploaded" }),
  );

  assert.equal(result[0].state, "invalid");
  assert.equal(result[0].validationCode, "TOO_LARGE");
  assert.equal(result[1].state, "uploaded");
});

test("a duplicate is skipped without blocking the batch", async () => {
  let call = 0;
  const result = await uploadPdfBatch(
    createPdfBatch([validPdf("duplicate.pdf"), validPdf("new.pdf")]),
    async () => ({ status: call++ === 0 ? "duplicate" : "uploaded" }),
  );

  assert.deepEqual(
    result.map((item) => item.state),
    ["duplicate", "uploaded"],
  );
});

test("an upload failure does not block the next PDF", async () => {
  let call = 0;
  const result = await uploadPdfBatch(
    createPdfBatch([validPdf("failed.pdf"), validPdf("next.pdf")]),
    async () => {
      if (call++ === 0) throw new Error("network failure");
      return { status: "uploaded" };
    },
  );

  assert.deepEqual(
    result.map((item) => item.state),
    ["failed", "uploaded"],
  );
});

test("the same batch workflow supports a single PDF", async () => {
  const result = await uploadPdfBatch(
    createPdfBatch([validPdf("single.pdf")]),
    async () => ({ status: "uploaded" }),
  );

  assert.equal(result.length, 1);
  assert.equal(result[0].state, "uploaded");
});
