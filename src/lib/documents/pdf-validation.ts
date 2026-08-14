export const MAX_PDF_SIZE_BYTES = 15 * 1024 * 1024;

const PDF_MIME_TYPE = "application/pdf";
const PDF_SIGNATURE = "%PDF-";

export type PdfValidationErrorCode =
  "INVALID_FILENAME" | "NOT_PDF" | "EMPTY" | "TOO_LARGE" | "INVALID_PDF";

export class PdfValidationError extends Error {
  constructor(readonly code: PdfValidationErrorCode) {
    super(code);
    this.name = "PdfValidationError";
  }
}

export type PdfFileMetadata = Pick<File, "name" | "size" | "type">;

export function validatePdfMetadata(file: PdfFileMetadata) {
  const originalFilename = file.name.split(/[\\/]/).at(-1)?.trim();

  if (!originalFilename || originalFilename.length > 255) {
    throw new PdfValidationError("INVALID_FILENAME");
  }

  if (
    file.type.toLowerCase() !== PDF_MIME_TYPE ||
    !originalFilename.toLowerCase().endsWith(".pdf")
  ) {
    throw new PdfValidationError("NOT_PDF");
  }

  if (file.size === 0) {
    throw new PdfValidationError("EMPTY");
  }

  if (file.size > MAX_PDF_SIZE_BYTES) {
    throw new PdfValidationError("TOO_LARGE");
  }

  return originalFilename;
}

export function validatePdfSignature(bytes: Uint8Array) {
  const signature = new TextDecoder("ascii").decode(
    bytes.subarray(0, PDF_SIGNATURE.length),
  );

  if (signature !== PDF_SIGNATURE) {
    throw new PdfValidationError("INVALID_PDF");
  }
}
