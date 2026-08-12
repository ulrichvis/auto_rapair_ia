import "server-only";

import { createHash } from "node:crypto";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/server/prisma";
import {
  removePrivatePdf,
  requirePrivatePdfBucket,
  uploadPrivatePdf,
} from "@/lib/server/supabase-storage";

export const MAX_PDF_SIZE_BYTES = 4 * 1024 * 1024;

const PDF_MIME_TYPE = "application/pdf";
const PDF_SIGNATURE = "%PDF-";

export class PdfUploadError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "PdfUploadError";
  }
}

export type PdfUploadResult =
  | {
      status: "created";
      documentId: string;
      originalFilename: string;
    }
  | {
      status: "duplicate";
      documentId: string;
      originalFilename: string;
    };

function getSafeOriginalFilename(filename: string) {
  const basename = filename.split(/[\\/]/).at(-1)?.trim();

  if (!basename || basename.length > 255) {
    throw new PdfUploadError("The PDF filename is invalid or too long.", 400);
  }

  return basename;
}

function validatePdfMetadata(file: File) {
  const originalFilename = getSafeOriginalFilename(file.name);

  if (
    file.type.toLowerCase() !== PDF_MIME_TYPE ||
    !originalFilename.toLowerCase().endsWith(".pdf")
  ) {
    throw new PdfUploadError("Select a PDF file.", 400);
  }

  if (file.size === 0) {
    throw new PdfUploadError("The selected PDF is empty.", 400);
  }

  if (file.size > MAX_PDF_SIZE_BYTES) {
    throw new PdfUploadError("The PDF must be 4 MiB or smaller.", 413);
  }

  return originalFilename;
}

function validatePdfSignature(bytes: Buffer) {
  if (
    bytes.subarray(0, PDF_SIGNATURE.length).toString("ascii") !== PDF_SIGNATURE
  ) {
    throw new PdfUploadError("The selected file is not a valid PDF.", 400);
  }
}

function isUniqueConstraintError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export async function uploadPdfDocument(file: File): Promise<PdfUploadResult> {
  const originalFilename = validatePdfMetadata(file);
  const bytes = Buffer.from(await file.arrayBuffer());
  validatePdfSignature(bytes);
  const sha256 = createHash("sha256").update(bytes).digest("hex");

  const existingDocument = await prisma.sourceDocument.findUnique({
    where: { sha256 },
    select: { id: true, originalFilename: true },
  });

  if (existingDocument) {
    return {
      status: "duplicate",
      documentId: existingDocument.id,
      originalFilename: existingDocument.originalFilename,
    };
  }

  const bucketName = await requirePrivatePdfBucket();
  const storagePath = `${sha256.slice(0, 2)}/${sha256}.pdf`;
  const uploadStatus = await uploadPrivatePdf(bucketName, storagePath, bytes);
  const uploadedNewObject = uploadStatus === "created";

  try {
    const document = await prisma.sourceDocument.create({
      data: {
        originalFilename,
        storagePath,
        sha256,
        processingStatus: "PENDING",
      },
      select: { id: true },
    });

    return {
      status: "created",
      documentId: document.id,
      originalFilename,
    };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const duplicate = await prisma.sourceDocument.findUnique({
        where: { sha256 },
        select: { id: true, originalFilename: true },
      });

      if (duplicate) {
        return {
          status: "duplicate",
          documentId: duplicate.id,
          originalFilename: duplicate.originalFilename,
        };
      }
    }

    if (uploadedNewObject) {
      await removePrivatePdf(bucketName, storagePath);
    }

    throw error;
  }
}
