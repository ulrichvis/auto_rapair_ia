import "server-only";

import { createHash } from "node:crypto";

import { Prisma } from "@/generated/prisma/client";
import {
  PdfValidationError,
  type PdfValidationErrorCode,
  validatePdfMetadata,
  validatePdfSignature,
} from "@/lib/documents/pdf-validation";
import { prisma } from "@/lib/server/prisma";
import {
  removePrivatePdf,
  requirePrivatePdfBucket,
  uploadPrivatePdf,
} from "@/lib/server/supabase-storage";

export { MAX_PDF_SIZE_BYTES } from "@/lib/documents/pdf-validation";

export class PdfUploadError extends Error {
  constructor(
    readonly code: PdfValidationErrorCode | "FILE_REQUIRED",
    readonly status: number,
  ) {
    super(code);
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

function isUniqueConstraintError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export async function uploadPdfDocument(file: File): Promise<PdfUploadResult> {
  let originalFilename: string;

  try {
    originalFilename = validatePdfMetadata(file);
  } catch (error) {
    if (error instanceof PdfValidationError) {
      throw new PdfUploadError(
        error.code,
        error.code === "TOO_LARGE" ? 413 : 400,
      );
    }

    throw error;
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  try {
    validatePdfSignature(bytes);
  } catch (error) {
    if (error instanceof PdfValidationError) {
      throw new PdfUploadError(error.code, 400);
    }

    throw error;
  }
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
        processingStatus: "QUEUED",
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
