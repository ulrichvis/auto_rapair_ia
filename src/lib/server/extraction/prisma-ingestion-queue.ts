import "server-only";

import type { ClaimedExtractionRun } from "@/lib/extraction/extraction-service";
import { canQueueDocument } from "@/lib/extraction/queue-policy";
import { prisma } from "@/lib/server/prisma";

const INGESTION_QUEUE_ADVISORY_LOCK = 487_201_936;

export class IngestionQueueNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IngestionQueueNotFoundError";
  }
}

export class IngestionQueueConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IngestionQueueConflictError";
  }
}

export async function queueDocumentForExtraction(documentId: string) {
  const queued = await prisma.sourceDocument.updateMany({
    where: {
      id: documentId,
      processingStatus: { in: ["PENDING", "FAILED", "REVIEW_REQUIRED"] },
    },
    data: { processingStatus: "QUEUED" },
  });

  if (queued.count === 1) return { documentId, status: "QUEUED" as const };

  const document = await prisma.sourceDocument.findUnique({
    where: { id: documentId },
    select: { processingStatus: true },
  });

  if (!document) {
    throw new IngestionQueueNotFoundError("Source document not found.");
  }

  if (document.processingStatus === "QUEUED") {
    return { documentId, status: "QUEUED" as const };
  }

  if (!canQueueDocument(document.processingStatus)) {
    throw new IngestionQueueConflictError(
      "This document cannot be queued in its current state.",
    );
  }

  throw new IngestionQueueConflictError("The document could not be queued.");
}

export function claimNextQueuedExtraction(
  concurrency: number,
): Promise<ClaimedExtractionRun | null> {
  return prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw<Array<{ lock: string }>>`
      SELECT pg_advisory_xact_lock(${INGESTION_QUEUE_ADVISORY_LOCK})::text AS "lock"
    `;

    const activeCount = await transaction.sourceDocument.count({
      where: { processingStatus: "PROCESSING" },
    });

    if (activeCount >= concurrency) return null;

    const document = await transaction.sourceDocument.findFirst({
      where: { processingStatus: "QUEUED" },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        originalFilename: true,
        storagePath: true,
        processingStatus: true,
      },
    });

    if (!document) return null;

    const claimed = await transaction.sourceDocument.updateMany({
      where: { id: document.id, processingStatus: "QUEUED" },
      data: { processingStatus: "PROCESSING" },
    });

    if (claimed.count !== 1) return null;

    const run = await transaction.ingestionRun.create({
      data: {
        sourceDocumentId: document.id,
        status: "PROCESSING",
        extractor: "openai",
      },
      select: { id: true },
    });

    return {
      document: { ...document, processingStatus: "PROCESSING" },
      runId: run.id,
    };
  });
}
