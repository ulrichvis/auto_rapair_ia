import {
  PdfValidationError,
  type PdfFileMetadata,
  type PdfValidationErrorCode,
  validatePdfMetadata,
} from "./pdf-validation";

export type PdfBatchItemState =
  "ready" | "invalid" | "uploading" | "uploaded" | "duplicate" | "failed";

export type PdfBatchItem<TFile extends PdfFileMetadata = PdfFileMetadata> = {
  id: string;
  file: TFile;
  state: PdfBatchItemState;
  validationCode?: PdfValidationErrorCode;
  error?: string;
};

export type PdfBatchUploadResponse = {
  status: "uploaded" | "duplicate" | "invalid";
  error?: string;
};

export function createPdfBatch<TFile extends PdfFileMetadata>(
  files: readonly TFile[],
): PdfBatchItem<TFile>[] {
  return files.map((file, index) => {
    try {
      validatePdfMetadata(file);
      return {
        id: `${file.name}-${file.size}-${index}`,
        file,
        state: "ready" as const,
      };
    } catch (error) {
      if (error instanceof PdfValidationError) {
        return {
          id: `${file.name}-${file.size}-${index}`,
          file,
          state: "invalid" as const,
          validationCode: error.code,
        };
      }
      throw error;
    }
  });
}

export async function uploadPdfBatch<TFile extends PdfFileMetadata>(
  initialItems: PdfBatchItem<TFile>[],
  upload: (file: TFile) => Promise<PdfBatchUploadResponse>,
  onChange?: (items: PdfBatchItem<TFile>[]) => void,
) {
  const items = initialItems.map((item) => ({ ...item }));
  const emit = () => onChange?.(items.map((item) => ({ ...item })));

  emit();

  for (const item of items) {
    if (item.state === "invalid") continue;

    item.state = "uploading";
    emit();

    try {
      const result = await upload(item.file);
      item.state = result.status;
      item.error = result.error;
    } catch (error) {
      item.state = "failed";
      item.error = error instanceof Error ? error.message : "Upload failed";
    }

    emit();
  }

  return items;
}

export function summarizePdfBatch(items: PdfBatchItem[]) {
  return {
    selected: items.length,
    uploaded: items.filter((item) => item.state === "uploaded").length,
    duplicate: items.filter((item) => item.state === "duplicate").length,
    invalid: items.filter((item) => item.state === "invalid").length,
    failed: items.filter((item) => item.state === "failed").length,
    completed: items.filter((item) =>
      ["uploaded", "duplicate", "invalid", "failed"].includes(item.state),
    ).length,
  };
}
