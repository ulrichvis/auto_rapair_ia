import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { validateAutomotiveExtractionDraft } from "@/lib/extraction/automotive-draft-schema";
import {
  KnowledgeImportConflictError,
  KnowledgeImportNotFoundError,
  replaceKnowledgeFromReview,
} from "@/lib/server/import/import-knowledge";
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

export async function getDocumentReview(documentId: string) {
  const document = await prisma.sourceDocument.findUnique({
    where: { id: documentId },
    select: {
      id: true,
      originalFilename: true,
      pageCount: true,
      claimedPageCount: true,
      ingestionRuns: {
        where: {
          status: { in: ["SUCCESS", "IMPORTED", "FAILED"] },
          rawOutput: { not: Prisma.AnyNull },
        },
        orderBy: { startedAt: "desc" },
        take: 1,
        select: {
          id: true,
          rawOutput: true,
          reviewedOutput: true,
          completedAt: true,
          reviewedAt: true,
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
      "This document does not have extracted data to review.",
    );
  }

  const draft = validateAutomotiveExtractionDraft(
    run.reviewedOutput ?? run.rawOutput,
  );

  return {
    documentId: document.id,
    originalFilename: document.originalFilename,
    maxSourcePage:
      document.pageCount ??
      draft.document.claimedPageCount ??
      document.claimedPageCount,
    runId: run.id,
    completedAt: run.completedAt?.toISOString() ?? null,
    importedAt: run.importedAt?.toISOString() ?? null,
    reviewedAt: run.reviewedAt?.toISOString() ?? null,
    importedCases: run.importedCases,
    draft,
  };
}

export async function saveDocumentReview(
  documentId: string,
  runId: string,
  draftInput: unknown,
) {
  const draft = validateAutomotiveExtractionDraft(draftInput);

  try {
    const result = await replaceKnowledgeFromReview(documentId, runId, draft);
    return { draft, ...result };
  } catch (error) {
    if (error instanceof KnowledgeImportConflictError) {
      throw new ReviewDraftConflictError(error.message);
    }
    if (error instanceof KnowledgeImportNotFoundError) {
      throw new ReviewDraftNotFoundError(error.message);
    }
    throw error;
  }
}
