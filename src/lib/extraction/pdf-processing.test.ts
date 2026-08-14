import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { PDFDocument } from "pdf-lib";

import { preparePdfForExtraction } from "./pdf-processing";

async function pdfWithPadding(paddingBytes: number) {
  const document = await PDFDocument.create();
  document.addPage([100, 100]);
  const pdf = Buffer.from(await document.save());
  return Buffer.concat([pdf, Buffer.alloc(paddingBytes, 32)]);
}

async function onePagePdf() {
  return pdfWithPadding(0);
}

async function temporaryTestRoot() {
  const root = await mkdtemp(join(tmpdir(), "autorepair-test-"));
  await mkdir(root, { recursive: true });
  return root;
}

test("keeps the original unchanged and selects a meaningfully smaller PDF", async () => {
  const original = await pdfWithPadding(4_000);
  const snapshot = Buffer.from(original);
  const optimized = await onePagePdf();
  const root = await temporaryTestRoot();

  try {
    const prepared = await preparePdfForExtraction(original, {
      optimizer: async () => optimized,
      optimizationThresholdBytes: 0,
      minimumReductionBytes: 1,
      minimumReductionRatio: 0.01,
      temporaryRoot: root,
    });

    assert.equal(prepared.metadata.processingWasOptimized, true);
    assert.deepEqual(prepared.pdf, optimized);
    assert.deepEqual(original, snapshot);
    assert.equal((await readdir(root)).length, 1);

    await prepared.cleanup();
    assert.equal((await readdir(root)).length, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("falls back safely when optimization fails", async () => {
  const original = await onePagePdf();
  const warnings: string[] = [];
  const prepared = await preparePdfForExtraction(original, {
    optimizer: async () => {
      throw new Error("renderer failed");
    },
    optimizationThresholdBytes: 0,
    onWarning: (warning) => warnings.push(warning),
  });

  assert.strictEqual(prepared.pdf, original);
  assert.equal(prepared.metadata.processingWasOptimized, false);
  assert.match(prepared.metadata.processingWarning ?? "", /renderer failed/);
  assert.equal(warnings.length, 1);
});

test("uses the original when optimization has no useful size benefit", async () => {
  const original = await onePagePdf();
  const prepared = await preparePdfForExtraction(original, {
    optimizer: async () => Buffer.from(original),
    optimizationThresholdBytes: 0,
    minimumReductionBytes: 1,
  });

  assert.strictEqual(prepared.pdf, original);
  assert.equal(prepared.metadata.processingWasOptimized, false);
  assert.equal(prepared.metadata.processingFileSizeBytes, original.length);
});

test("rejects an optimized PDF with a changed page count", async () => {
  const original = await onePagePdf();
  const changed = await PDFDocument.create();
  changed.addPage([100, 100]);
  changed.addPage([100, 100]);

  const prepared = await preparePdfForExtraction(original, {
    optimizer: async () => Buffer.from(await changed.save()),
    optimizationThresholdBytes: 0,
  });

  assert.strictEqual(prepared.pdf, original);
  assert.match(prepared.metadata.processingWarning ?? "", /page count changed/);
});
