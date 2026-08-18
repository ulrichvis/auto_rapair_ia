export const DEFAULT_INGESTION_CONCURRENCY = 2;
export const MAX_INGESTION_CONCURRENCY = 5;

export function parseIngestionConcurrency(value: string | undefined) {
  if (!value) return DEFAULT_INGESTION_CONCURRENCY;

  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed >= 1
    ? Math.min(parsed, MAX_INGESTION_CONCURRENCY)
    : DEFAULT_INGESTION_CONCURRENCY;
}

export function canQueueDocument(processingStatus: string) {
  return ["PENDING", "FAILED", "REVIEW_REQUIRED"].includes(processingStatus);
}
