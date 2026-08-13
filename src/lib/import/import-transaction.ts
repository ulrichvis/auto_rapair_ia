export type ImportStateErrorCode =
  "NOT_FOUND" | "NOT_REVIEWED" | "ALREADY_IMPORTED" | "STALE";

export class ImportStateError extends Error {
  constructor(readonly code: ImportStateErrorCode) {
    super(code);
    this.name = "ImportStateError";
  }
}

export function assertImportableRun(
  run: {
    id: string;
    sourceDocumentId: string;
    status: string;
    hasRawOutput: boolean;
    reviewedAt: Date | null;
    importedAt: Date | null;
  } | null,
  expectedDocumentId: string,
  latestSuccessfulRunId: string | null,
) {
  if (
    !run ||
    run.sourceDocumentId !== expectedDocumentId ||
    run.status !== "SUCCESS" ||
    !run.hasRawOutput
  ) {
    throw new ImportStateError("NOT_FOUND");
  }
  if (!run.reviewedAt) throw new ImportStateError("NOT_REVIEWED");
  if (run.importedAt) throw new ImportStateError("ALREADY_IMPORTED");
  if (latestSuccessfulRunId !== run.id) throw new ImportStateError("STALE");
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
