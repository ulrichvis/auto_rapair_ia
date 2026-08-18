import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { AutomotiveExtractionDraft } from "@/lib/extraction/automotive-draft-schema";
import {
  technicalCaseEditQuery,
  technicalCaseToEditDraft,
  type TechnicalCaseEditRecord,
} from "@/lib/knowledge/technical-case-editor";
import {
  buildManualEditLifecycle,
  buildTechnicalCaseEditPlan,
  runAtomicCaseEdit,
} from "@/lib/knowledge/technical-case-edit-plan";
import { createTechnicalCaseFacts } from "@/lib/server/knowledge/persist-technical-case-facts";
import { prisma } from "@/lib/server/prisma";

export class TechnicalCaseEditNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TechnicalCaseEditNotFoundError";
  }
}

export class TechnicalCaseEditConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TechnicalCaseEditConflictError";
  }
}

function factSourceDocumentIds(technicalCase: TechnicalCaseEditRecord) {
  return [
    ...technicalCase.applicability,
    ...technicalCase.faultCodes,
    ...technicalCase.symptoms,
    ...technicalCase.components,
    ...technicalCase.causes,
    ...technicalCase.solutions,
    ...technicalCase.procedures.flatMap((procedure) => procedure.steps),
    ...technicalCase.measurementSpecs,
    ...technicalCase.notes,
    ...technicalCase.parts,
  ]
    .map((item) => item.sourceDocumentId)
    .filter((value): value is string => value !== null);
}

export function assertEditableSourceTraceability(
  technicalCase: TechnicalCaseEditRecord,
  primarySourceDocumentId: string | null,
) {
  const sourceIds = new Set(factSourceDocumentIds(technicalCase));

  if (
    technicalCase.sources.length > 1 ||
    [...sourceIds].some((sourceId) => sourceId !== primarySourceDocumentId) ||
    technicalCase.media.some(
      (media) => media.componentId !== null || media.procedureStepId !== null,
    )
  ) {
    throw new TechnicalCaseEditConflictError(
      "This case has source or media relationships that the V1 editor cannot safely replace.",
    );
  }
}

export async function getTechnicalCaseEdit(caseId: string) {
  const technicalCase = await prisma.technicalCase.findUnique(
    technicalCaseEditQuery(caseId),
  );

  if (!technicalCase) {
    throw new TechnicalCaseEditNotFoundError("Technical case not found.");
  }

  return {
    caseId: technicalCase.id,
    updatedAt: technicalCase.updatedAt.toISOString(),
    ...technicalCaseToEditDraft(technicalCase),
  };
}

export async function updateTechnicalCaseKnowledge(
  caseId: string,
  expectedUpdatedAt: string,
  draftInput: unknown,
) {
  return runAtomicCaseEdit<
    Prisma.TransactionClient,
    {
      caseId: string;
      title: string;
      updatedAt: string;
      reviewedAt: string;
      draft: AutomotiveExtractionDraft;
    }
  >(
    { $transaction: (work) => prisma.$transaction(work) },
    async (transaction) => {
      const current = await transaction.technicalCase.findUnique(
        technicalCaseEditQuery(caseId),
      );

      if (!current) {
        throw new TechnicalCaseEditNotFoundError("Technical case not found.");
      }

      if (current.updatedAt.toISOString() !== expectedUpdatedAt) {
        throw new TechnicalCaseEditConflictError(
          "The technical case was modified after this editor was opened.",
        );
      }

      const editSource = technicalCaseToEditDraft(current);
      assertEditableSourceTraceability(current, editSource.sourceDocumentId);
      const plan = buildTechnicalCaseEditPlan(
        draftInput,
        editSource.maxSourcePage,
      );
      const technicalCase = plan.draft.cases[0];
      const referencePlan = plan.references[0];
      const now = new Date();
      const lifecycle = buildManualEditLifecycle(now);

      await deleteTechnicalCaseFacts(transaction, caseId);
      await createTechnicalCaseFacts(
        transaction,
        caseId,
        editSource.sourceDocumentId,
        technicalCase,
        referencePlan,
      );

      const updated = await transaction.technicalCase.update({
        where: { id: caseId },
        data: {
          title: technicalCase.title,
          summary: technicalCase.summary,
          problemDescription: technicalCase.problemDescription,
          primarySystem: technicalCase.primarySystem,
          ...lifecycle,
        },
        select: { id: true, title: true, updatedAt: true, reviewedAt: true },
      });

      return {
        caseId: updated.id,
        title: updated.title,
        updatedAt: updated.updatedAt.toISOString(),
        reviewedAt: updated.reviewedAt!.toISOString(),
        draft: plan.draft,
      };
    },
  );
}

async function deleteTechnicalCaseFacts(
  transaction: Prisma.TransactionClient,
  technicalCaseId: string,
) {
  const where = { technicalCaseId };

  await transaction.measurementSpec.deleteMany({ where });
  await transaction.caseNote.deleteMany({ where });
  await transaction.casePart.deleteMany({ where });
  await transaction.caseCause.deleteMany({ where });
  await transaction.caseSolution.deleteMany({ where });
  await transaction.procedure.deleteMany({ where });
  await transaction.caseFaultCode.deleteMany({ where });
  await transaction.caseSymptom.deleteMany({ where });
  await transaction.caseComponent.deleteMany({ where });
  await transaction.caseApplicability.deleteMany({ where });
}
