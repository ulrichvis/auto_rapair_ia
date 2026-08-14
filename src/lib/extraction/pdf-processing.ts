import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { PDFDocument } from "pdf-lib";

const DEFAULT_OPTIMIZATION_THRESHOLD_BYTES = 5 * 1024 * 1024;
const DEFAULT_MINIMUM_REDUCTION_BYTES = 256 * 1024;
const DEFAULT_MINIMUM_REDUCTION_RATIO = 0.1;

export type PdfProcessingMetadata = {
  originalFileSizeBytes: number;
  processingFileSizeBytes: number;
  processingWasOptimized: boolean;
  processingWarning: string | null;
};

export type PreparedPdf = {
  pdf: Buffer;
  metadata: PdfProcessingMetadata;
  cleanup(): Promise<void>;
};

export type PdfProcessingOptions = {
  optimizer(pdf: Buffer): Promise<Buffer>;
  optimizationThresholdBytes?: number;
  minimumReductionBytes?: number;
  minimumReductionRatio?: number;
  temporaryRoot?: string;
  onWarning?(message: string): void;
};

function originalResult(original: Buffer, warning: string | null): PreparedPdf {
  return {
    pdf: original,
    metadata: {
      originalFileSizeBytes: original.length,
      processingFileSizeBytes: original.length,
      processingWasOptimized: false,
      processingWarning: warning,
    },
    async cleanup() {},
  };
}

function safeWarning(error: unknown) {
  const detail = error instanceof Error ? error.message : "unknown failure";
  return `PDF optimization was skipped: ${detail}`.slice(0, 1_000);
}

async function pageCount(pdf: Buffer) {
  const document = await PDFDocument.load(pdf, {
    ignoreEncryption: false,
    updateMetadata: false,
  });

  return document.getPageCount();
}

export async function preparePdfForExtraction(
  original: Buffer,
  options: PdfProcessingOptions,
): Promise<PreparedPdf> {
  const threshold =
    options.optimizationThresholdBytes ?? DEFAULT_OPTIMIZATION_THRESHOLD_BYTES;

  if (original.length < threshold) {
    return originalResult(original, null);
  }

  let temporaryDirectory: string | null = null;

  try {
    const optimized = await options.optimizer(original);
    const originalPageCount = await pageCount(original);
    const optimizedPageCount = await pageCount(optimized);

    if (optimizedPageCount !== originalPageCount) {
      throw new Error(
        `page count changed from ${originalPageCount} to ${optimizedPageCount}`,
      );
    }

    const reductionBytes = original.length - optimized.length;
    const reductionRatio = reductionBytes / original.length;
    const minimumBytes =
      options.minimumReductionBytes ?? DEFAULT_MINIMUM_REDUCTION_BYTES;
    const minimumRatio =
      options.minimumReductionRatio ?? DEFAULT_MINIMUM_REDUCTION_RATIO;

    if (reductionBytes < minimumBytes || reductionRatio < minimumRatio) {
      return originalResult(original, null);
    }

    const temporaryRoot = resolve(options.temporaryRoot ?? tmpdir());
    temporaryDirectory = await mkdtemp(
      join(temporaryRoot, "autorepair-processing-"),
    );
    const processingPath = join(temporaryDirectory, "processing.pdf");
    await writeFile(processingPath, optimized, { flag: "wx" });
    const processingPdf = await readFile(processingPath);
    let cleaned = false;

    return {
      pdf: processingPdf,
      metadata: {
        originalFileSizeBytes: original.length,
        processingFileSizeBytes: processingPdf.length,
        processingWasOptimized: true,
        processingWarning: null,
      },
      async cleanup() {
        if (cleaned) return;
        cleaned = true;
        await rm(temporaryDirectory!, { recursive: true, force: true });
      },
    };
  } catch (error) {
    if (temporaryDirectory) {
      await rm(temporaryDirectory, { recursive: true, force: true }).catch(
        () => {},
      );
    }

    const warning = safeWarning(error);
    options.onWarning?.(warning);
    return originalResult(original, warning);
  }
}
