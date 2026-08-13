import "server-only";

import { Prisma } from "@/generated/prisma/client";
import {
  validateAutomotiveExtractionDraft,
  type AutomotiveExtractionDraft,
} from "@/lib/extraction/automotive-draft-schema";
import { prisma } from "@/lib/server/prisma";

export class ReviewDraftNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReviewDraftNotFoundError";
  }
}

export class ReviewDraftConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReviewDraftConflictError";
  }
}

export class ReviewDraftImportedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReviewDraftImportedError";
  }
}

function toJsonValue(draft: AutomotiveExtractionDraft) {
  return JSON.parse(JSON.stringify(draft)) as Prisma.InputJsonValue;
}

export async function getDocumentReview(documentId: string) {
  const document = await prisma.sourceDocument.findUnique({
    where: { id: documentId },
    select: {
      id: true,
      originalFilename: true,
      ingestionRuns: {
        where: { status: "SUCCESS" },
        orderBy: { startedAt: "desc" },
        take: 1,
        select: {
          id: true,
          rawOutput: true,
          completedAt: true,
          importedAt: true,
          importedCases: {
            select: { id: true, title: true },
            orderBy: { createdAt: "asc" },
          },
        },
      },
    },
  });

  if (!document) {
    throw new ReviewDraftNotFoundError("Source document not found.");
  }

  const run = document.ingestionRuns[0];

  if (!run?.rawOutput) {
    throw new ReviewDraftNotFoundError(
      "This document does not have a successful extraction to review.",
    );
  }

  return {
    documentId: document.id,
    originalFilename: document.originalFilename,
    runId: run.id,
    completedAt: run.completedAt?.toISOString() ?? null,
    importedAt: run.importedAt?.toISOString() ?? null,
    importedCases: run.importedCases,
    draft: validateAutomotiveExtractionDraft(run.rawOutput),
  };
}

export async function saveDocumentReview(
  documentId: string,
  runId: string,
  draftInput: unknown,
) {
  const draft = validateAutomotiveExtractionDraft(draftInput);

  await prisma.$transaction(async (transaction) => {
    const latestRun = await transaction.ingestionRun.findFirst({
      where: {
        sourceDocumentId: documentId,
        status: "SUCCESS",
      },
      orderBy: { startedAt: "desc" },
      select: { id: true, importedAt: true },
    });

    if (!latestRun) {
      throw new ReviewDraftNotFoundError(
        "This document does not have a successful extraction to review.",
      );
    }

    if (latestRun.id !== runId) {
      throw new ReviewDraftConflictError(
        "A newer extraction is available. Reload before saving.",
      );
    }

    if (latestRun.importedAt) {
      throw new ReviewDraftImportedError(
        "Imported reviewed drafts can no longer be changed.",
      );
    }

    await transaction.ingestionRun.update({
      where: { id: latestRun.id },
      data: { rawOutput: toJsonValue(draft), reviewedAt: new Date() },
    });
  });

  return draft;
}
