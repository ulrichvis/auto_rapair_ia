import "server-only";

import { parseIngestionConcurrency } from "@/lib/extraction/queue-policy";

import { processClaimedDocument } from "./extract-document";
import { claimNextQueuedExtraction } from "./prisma-ingestion-queue";

export function getIngestionConcurrency() {
  return parseIngestionConcurrency(process.env.INGESTION_CONCURRENCY);
}

export async function drainNextIngestionJob() {
  const claim = await claimNextQueuedExtraction(getIngestionConcurrency());

  if (!claim) return { claimed: false as const };

  try {
    await processClaimedDocument(claim);
    return {
      claimed: true as const,
      documentId: claim.document.id,
      status: "IMPORTED" as const,
    };
  } catch (error) {
    console.error("Queued PDF ingestion failed", {
      documentId: claim.document.id,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return {
      claimed: true as const,
      documentId: claim.document.id,
      status: "FAILED" as const,
    };
  }
}
