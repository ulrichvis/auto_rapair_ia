import { validateAutomotiveExtractionDraft } from "../extraction/automotive-draft-schema";
import {
  buildKnowledgeImportPlan,
  KnowledgeImportValidationError,
} from "../import/knowledge-import-plan";

export function buildTechnicalCaseEditPlan(
  draftInput: unknown,
  maxSourcePage: number | null,
) {
  const draft = validateAutomotiveExtractionDraft(draftInput);

  if (draft.cases.length !== 1) {
    throw new KnowledgeImportValidationError([
      { code: "SINGLE_CASE_REQUIRED", path: "cases" },
    ]);
  }

  return buildKnowledgeImportPlan(draft, { maxSourcePage });
}

export function buildManualEditLifecycle(now: Date) {
  return {
    validationStatus: "VALIDATED" as const,
    validatedAt: now,
    reviewedByHuman: true,
    reviewedAt: now,
  };
}

export async function runAtomicCaseEdit<TTransaction, TResult>(
  database: {
    $transaction: (
      work: (transaction: TTransaction) => Promise<TResult>,
    ) => Promise<TResult>;
  },
  work: (transaction: TTransaction) => Promise<TResult>,
) {
  return database.$transaction(work);
}
