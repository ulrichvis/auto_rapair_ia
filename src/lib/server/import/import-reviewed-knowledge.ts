import "server-only";

import { Prisma } from "@/generated/prisma/client";
import {
  validateAutomotiveExtractionDraft,
  type AutomotiveExtractionDraft,
} from "@/lib/extraction/automotive-draft-schema";
import {
  assertAutomaticallyImportableRun,
  buildHumanReviewRunUpdate,
  buildTechnicalCaseLifecycle,
  ImportStateError,
  runAtomicImport,
} from "@/lib/import/import-transaction";
import { buildKnowledgeImportPlan } from "@/lib/import/knowledge-import-plan";
import { prisma } from "@/lib/server/prisma";

export class KnowledgeImportNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KnowledgeImportNotFoundError";
  }
}

export class KnowledgeImportConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KnowledgeImportConflictError";
  }
}

export class KnowledgeAlreadyImportedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KnowledgeAlreadyImportedError";
  }
}

export type ImportedCaseSummary = { id: string; title: string };

type ImportOptions =
  | { mode: "automatic" }
  | { mode: "human-review"; draft: AutomotiveExtractionDraft };

function toJsonValue(draft: AutomotiveExtractionDraft) {
  return JSON.parse(JSON.stringify(draft)) as Prisma.InputJsonValue;
}

async function importKnowledge(
  documentId: string,
  runId: string,
  options: ImportOptions,
): Promise<{ importedAt: string; cases: ImportedCaseSummary[] }> {
  try {
    return await runAtomicImport<
      Prisma.TransactionClient,
      { importedAt: string; cases: ImportedCaseSummary[] }
    >(
      { $transaction: (work) => prisma.$transaction(work) },
      async (transaction) => {
        const document = await transaction.sourceDocument.findUnique({
          where: { id: documentId },
          select: {
            id: true,
            pageCount: true,
            claimedPageCount: true,
          },
        });

        if (!document) {
          throw new KnowledgeImportNotFoundError("Source document not found.");
        }

        const run = await transaction.ingestionRun.findUnique({
          where: { id: runId },
          select: {
            id: true,
            sourceDocumentId: true,
            status: true,
            rawOutput: true,
            importedAt: true,
          },
        });

        const latestRun = await transaction.ingestionRun.findFirst({
          where: {
            sourceDocumentId: documentId,
            rawOutput: { not: Prisma.AnyNull },
          },
          orderBy: { startedAt: "desc" },
          select: { id: true },
        });

        if (options.mode === "automatic") {
          assertAutomaticallyImportableRun(
            run
              ? {
                  id: run.id,
                  sourceDocumentId: run.sourceDocumentId,
                  status: run.status,
                  hasRawOutput: Boolean(run.rawOutput),
                  importedAt: run.importedAt,
                }
              : null,
            documentId,
            latestRun?.id ?? null,
          );
        } else if (
          !run ||
          run.sourceDocumentId !== documentId ||
          !run.rawOutput ||
          latestRun?.id !== run.id ||
          run.status === "PROCESSING" ||
          run.status === "IMPORTING"
        ) {
          throw new ImportStateError(
            latestRun?.id !== runId ? "STALE" : "NOT_FOUND",
          );
        }

        const draft =
          options.mode === "human-review"
            ? options.draft
            : validateAutomotiveExtractionDraft(run!.rawOutput);
        const plan = buildKnowledgeImportPlan(draft, {
          maxSourcePage:
            document.pageCount ??
            draft.document.claimedPageCount ??
            document.claimedPageCount,
        });
        const relationalDraft = plan.draft;
        const now = new Date();
        const importedAt = run!.importedAt ?? now;
        let importedAutomatically = options.mode === "automatic";

        if (options.mode === "automatic") {
          const claimed = await transaction.ingestionRun.updateMany({
            where: {
              id: run!.id,
              status: "IMPORTING",
              importedAt: null,
            },
            data: { importedAt },
          });
          if (claimed.count !== 1) {
            throw new KnowledgeAlreadyImportedError(
              "This extraction has already been imported.",
            );
          }
        } else {
          const automaticCase = await transaction.technicalCase.findFirst({
            where: {
              importedFromRunId: run!.id,
              importedAutomatically: true,
            },
            select: { id: true },
          });
          importedAutomatically = Boolean(automaticCase);
          await transaction.technicalCase.deleteMany({
            where: { importedFromRunId: run!.id },
          });
        }

        const importedCases: ImportedCaseSummary[] = [];

        for (const [
          caseIndex,
          technicalCase,
        ] of relationalDraft.cases.entries()) {
          const referencePlan = plan.references[caseIndex];
          const lifecycle = buildTechnicalCaseLifecycle(
            options.mode,
            importedAutomatically,
            now,
          );
          const createdCase = await transaction.technicalCase.create({
            data: {
              title: technicalCase.title,
              summary: technicalCase.summary,
              problemDescription: technicalCase.problemDescription,
              primarySystem: technicalCase.primarySystem,
              ...lifecycle,
              importedFromRunId: run!.id,
              sources: {
                create: { sourceDocumentId: documentId, isPrimary: true },
              },
            },
            select: { id: true, title: true },
          });
          importedCases.push(createdCase);

          const applicabilityIds: string[] = [];
          for (const item of technicalCase.applicability) {
            const created = await transaction.caseApplicability.create({
              data: {
                technicalCaseId: createdCase.id,
                brand: item.brand,
                model: item.model,
                generationOrPlatform: item.generationOrPlatform,
                yearFrom: item.yearFrom,
                yearTo: item.yearTo,
                engineLabel: item.engineLabel,
                engineFamily: item.engineFamily,
                engineCode: item.engineCode,
                engineCodePattern: item.engineCodePattern,
                engineMatchType: item.engineMatchType,
                fuelType: item.fuelType,
                transmission: item.transmission,
                variantNotes: item.variantNotes,
                sourceDocumentId: documentId,
                sourcePage: item.sourcePage,
              },
              select: { id: true },
            });
            applicabilityIds.push(created.id);
          }

          const componentIds: string[] = [];
          for (const item of technicalCase.components) {
            const created = await transaction.caseComponent.create({
              data: {
                technicalCaseId: createdCase.id,
                name: item.name,
                normalizedName: item.normalizedName,
                manufacturerIdentifier: item.manufacturerIdentifier,
                system: item.system,
                role: item.role,
                sourceDocumentId: documentId,
                sourcePage: item.sourcePage,
              },
              select: { id: true },
            });
            componentIds.push(created.id);
          }

          if (technicalCase.faultCodes.length > 0) {
            await transaction.caseFaultCode.createMany({
              data: technicalCase.faultCodes.map((item) => ({
                technicalCaseId: createdCase.id,
                rawCode: item.rawCode,
                normalizedCode: item.normalizedCode,
                manufacturerCode: item.manufacturerCode,
                description: item.description,
                role: item.role,
                controlModule: item.controlModule,
                sourceDocumentId: documentId,
                sourcePage: item.sourcePage,
              })),
            });
          }

          if (technicalCase.symptoms.length > 0) {
            await transaction.caseSymptom.createMany({
              data: technicalCase.symptoms.map((item) => ({
                technicalCaseId: createdCase.id,
                label: item.label,
                normalizedLabel: item.normalizedLabel,
                details: item.details,
                operatingCondition: item.operatingCondition,
                sourceDocumentId: documentId,
                sourcePage: item.sourcePage,
              })),
            });
          }

          if (technicalCase.causes.length > 0) {
            await transaction.caseCause.createMany({
              data: technicalCase.causes.map((item, index) => ({
                technicalCaseId: createdCase.id,
                componentId:
                  referencePlan.causeComponents[index] === null
                    ? null
                    : componentIds[referencePlan.causeComponents[index]],
                description: item.description,
                category: item.category,
                certainty:
                  item.certainty === "LIKELY" ? "PROBABLE" : item.certainty,
                priority: item.priority,
                conditionText: item.conditionText,
                sourceDocumentId: documentId,
                sourcePage: item.sourcePage,
              })),
            });
          }

          if (technicalCase.solutions.length > 0) {
            await transaction.caseSolution.createMany({
              data: technicalCase.solutions.map((item, index) => ({
                technicalCaseId: createdCase.id,
                componentId:
                  referencePlan.solutionComponents[index] === null
                    ? null
                    : componentIds[referencePlan.solutionComponents[index]],
                type: item.type!,
                description: item.description,
                conditionText: item.conditionText,
                priority: item.priority,
                sourceDocumentId: documentId,
                sourcePage: item.sourcePage,
              })),
            });
          }

          const stepIds: string[][] = [];
          for (const [
            procedureIndex,
            procedure,
          ] of technicalCase.procedures.entries()) {
            const createdProcedure = await transaction.procedure.create({
              data: {
                technicalCaseId: createdCase.id,
                type: procedure.type,
                title: procedure.title,
                description: procedure.description,
                position: procedure.position,
              },
              select: { id: true },
            });
            const procedureStepIds: string[] = [];
            for (const [stepIndex, step] of procedure.steps.entries()) {
              const resolved = referencePlan.steps[procedureIndex][stepIndex];
              const createdStep = await transaction.procedureStep.create({
                data: {
                  procedureId: createdProcedure.id,
                  position: step.position,
                  instruction: step.instruction,
                  precondition: step.precondition,
                  expectedResult: step.expectedResult,
                  ifPass: step.ifPass,
                  ifFail: step.ifFail,
                  toolsText: step.toolsText,
                  componentId:
                    resolved.component === null
                      ? null
                      : componentIds[resolved.component],
                  applicabilityId:
                    resolved.applicability === null
                      ? null
                      : applicabilityIds[resolved.applicability],
                  sourceDocumentId: documentId,
                  sourcePage: step.sourcePage,
                },
                select: { id: true },
              });
              procedureStepIds.push(createdStep.id);
            }
            stepIds.push(procedureStepIds);
          }

          if (technicalCase.measurements.length > 0) {
            await transaction.measurementSpec.createMany({
              data: technicalCase.measurements.map((item, index) => {
                const resolved = referencePlan.measurements[index];
                return {
                  technicalCaseId: createdCase.id,
                  procedureStepId: resolved.procedureStep
                    ? stepIds[resolved.procedureStep.procedure][
                        resolved.procedureStep.step
                      ]
                    : null,
                  componentId:
                    resolved.component === null
                      ? null
                      : componentIds[resolved.component],
                  applicabilityId:
                    resolved.applicability === null
                      ? null
                      : applicabilityIds[resolved.applicability],
                  parameter: item.parameter,
                  measurementType: item.measurementType,
                  targetValue: item.targetValue,
                  minValue: item.minValue,
                  maxValue: item.maxValue,
                  tolerancePlus: item.tolerancePlus,
                  toleranceMinus: item.toleranceMinus,
                  unit: item.unit,
                  expectedText: item.expectedText,
                  conditionText: item.conditionText,
                  durationSeconds: item.durationSeconds,
                  repeatCount: item.repeatCount,
                  isApproximate: item.isApproximate,
                  isExample: item.isExample,
                  sourceDocumentId: documentId,
                  sourcePage: item.sourcePage,
                };
              }),
            });
          }

          if (technicalCase.notes.length > 0) {
            await transaction.caseNote.createMany({
              data: technicalCase.notes.map((item, index) => {
                const resolved = referencePlan.notes[index];
                return {
                  technicalCaseId: createdCase.id,
                  procedureStepId: resolved.procedureStep
                    ? stepIds[resolved.procedureStep.procedure][
                        resolved.procedureStep.step
                      ]
                    : null,
                  applicabilityId:
                    resolved.applicability === null
                      ? null
                      : applicabilityIds[resolved.applicability],
                  type: item.type,
                  text: item.text,
                  externalReference: item.externalReference,
                  sourceDocumentId: documentId,
                  sourcePage: item.sourcePage,
                };
              }),
            });
          }

          if (technicalCase.parts.length > 0) {
            await transaction.casePart.createMany({
              data: technicalCase.parts.map((item, index) => {
                const resolved = referencePlan.parts[index];
                return {
                  technicalCaseId: createdCase.id,
                  componentId:
                    resolved.component === null
                      ? null
                      : componentIds[resolved.component],
                  applicabilityId:
                    resolved.applicability === null
                      ? null
                      : applicabilityIds[resolved.applicability],
                  partNumber: item.partNumber,
                  description: item.description,
                  role: item.role,
                  vinVerificationRequired: item.vinVerificationRequired,
                  sourceDocumentId: documentId,
                  sourcePage: item.sourcePage,
                };
              }),
            });
          }
        }

        const documentMetadata = relationalDraft.document;
        await transaction.ingestionRun.update({
          where: { id: run!.id },
          data: {
            status: "IMPORTED",
            importedAt,
            ...(options.mode === "human-review"
              ? buildHumanReviewRunUpdate(toJsonValue(draft), now)
              : {}),
            errorMessage: null,
            completedAt: now,
          },
        });
        await transaction.sourceDocument.update({
          where: { id: documentId },
          data: {
            title: documentMetadata.detectedTitle ?? undefined,
            bulletinReference: documentMetadata.bulletinReference ?? undefined,
            publisher: documentMetadata.publisher ?? undefined,
            language:
              options.mode === "human-review"
                ? (documentMetadata.language ?? undefined)
                : undefined,
            claimedPageCount: documentMetadata.claimedPageCount ?? undefined,
            processingStatus: "COMPLETED",
          },
        });

        return { importedAt: importedAt.toISOString(), cases: importedCases };
      },
    );
  } catch (error) {
    if (error instanceof ImportStateError) {
      if (error.code === "ALREADY_IMPORTED") {
        throw new KnowledgeAlreadyImportedError(
          "This extraction has already been imported.",
        );
      }
      if (error.code === "STALE") {
        throw new KnowledgeImportConflictError(
          "A newer extraction is available.",
        );
      }
      throw new KnowledgeImportNotFoundError(
        "The extracted ingestion run was not found.",
      );
    }
    throw error;
  }
}

export function importExtractedKnowledge(documentId: string, runId: string) {
  return importKnowledge(documentId, runId, { mode: "automatic" });
}

export function replaceKnowledgeFromReview(
  documentId: string,
  runId: string,
  draft: AutomotiveExtractionDraft,
) {
  return importKnowledge(documentId, runId, { mode: "human-review", draft });
}
