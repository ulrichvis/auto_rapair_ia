export type ImportStateErrorCode = "NOT_FOUND" | "ALREADY_IMPORTED" | "STALE";

export class ImportStateError extends Error {
  constructor(readonly code: ImportStateErrorCode) {
    super(code);
    this.name = "ImportStateError";
  }
}

export function buildTechnicalCaseLifecycle(
  mode: "automatic" | "human-review",
  importedAutomatically: boolean,
  now: Date,
) {
  return mode === "automatic"
    ? {
        validationStatus: "IN_REVIEW" as const,
        validatedAt: null,
        importedAutomatically: true,
        reviewedByHuman: false,
        reviewedAt: null,
      }
    : {
        validationStatus: "VALIDATED" as const,
        validatedAt: now,
        importedAutomatically,
        reviewedByHuman: true,
        reviewedAt: now,
      };
}

export function buildHumanReviewRunUpdate<T>(
  reviewedOutput: T,
  reviewedAt: Date,
) {
  return { reviewedOutput, reviewedAt };
}

export function assertAutomaticallyImportableRun(
  run: {
    id: string;
    sourceDocumentId: string;
    status: string;
    hasRawOutput: boolean;
    importedAt: Date | null;
  } | null,
  expectedDocumentId: string,
  latestExtractedRunId: string | null,
) {
  if (
    !run ||
    run.sourceDocumentId !== expectedDocumentId ||
    !run.hasRawOutput
  ) {
    throw new ImportStateError("NOT_FOUND");
  }
  if (run.importedAt) throw new ImportStateError("ALREADY_IMPORTED");
  if (run.status !== "IMPORTING") throw new ImportStateError("NOT_FOUND");
  if (latestExtractedRunId !== run.id) throw new ImportStateError("STALE");
}

export async function runAtomicImport<TTransaction, TResult>(
  database: {
    $transaction: (
      work: (transaction: TTransaction) => Promise<TResult>,
    ) => Promise<TResult>;
  },
  work: (transaction: TTransaction) => Promise<TResult>,
) {
  return database.$transaction(work);
}
