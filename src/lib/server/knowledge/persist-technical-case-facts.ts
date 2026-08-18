import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { AutomotiveExtractionDraft } from "@/lib/extraction/automotive-draft-schema";
import type { CaseReferencePlan } from "@/lib/import/knowledge-import-plan";

type DraftCase = AutomotiveExtractionDraft["cases"][number];

export async function createTechnicalCaseFacts(
  transaction: Prisma.TransactionClient,
  technicalCaseId: string,
  sourceDocumentId: string | null,
  technicalCase: DraftCase,
  referencePlan: CaseReferencePlan,
) {
  const applicabilityIds: string[] = [];
  for (const item of technicalCase.applicability) {
    const created = await transaction.caseApplicability.create({
      data: {
        technicalCaseId,
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
        sourceDocumentId,
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
        technicalCaseId,
        name: item.name,
        normalizedName: item.normalizedName,
        manufacturerIdentifier: item.manufacturerIdentifier,
        system: item.system,
        role: item.role,
        sourceDocumentId,
        sourcePage: item.sourcePage,
      },
      select: { id: true },
    });
    componentIds.push(created.id);
  }

  if (technicalCase.faultCodes.length > 0) {
    await transaction.caseFaultCode.createMany({
      data: technicalCase.faultCodes.map((item) => ({
        technicalCaseId,
        rawCode: item.rawCode,
        normalizedCode: item.normalizedCode,
        manufacturerCode: item.manufacturerCode,
        description: item.description,
        role: item.role,
        controlModule: item.controlModule,
        sourceDocumentId,
        sourcePage: item.sourcePage,
      })),
    });
  }

  if (technicalCase.symptoms.length > 0) {
    await transaction.caseSymptom.createMany({
      data: technicalCase.symptoms.map((item) => ({
        technicalCaseId,
        label: item.label,
        normalizedLabel: item.normalizedLabel,
        details: item.details,
        operatingCondition: item.operatingCondition,
        sourceDocumentId,
        sourcePage: item.sourcePage,
      })),
    });
  }

  if (technicalCase.causes.length > 0) {
    await transaction.caseCause.createMany({
      data: technicalCase.causes.map((item, index) => ({
        technicalCaseId,
        componentId:
          referencePlan.causeComponents[index] === null
            ? null
            : componentIds[referencePlan.causeComponents[index]],
        description: item.description,
        category: item.category,
        certainty: item.certainty === "LIKELY" ? "PROBABLE" : item.certainty,
        priority: item.priority,
        conditionText: item.conditionText,
        sourceDocumentId,
        sourcePage: item.sourcePage,
      })),
    });
  }

  if (technicalCase.solutions.length > 0) {
    await transaction.caseSolution.createMany({
      data: technicalCase.solutions.map((item, index) => ({
        technicalCaseId,
        componentId:
          referencePlan.solutionComponents[index] === null
            ? null
            : componentIds[referencePlan.solutionComponents[index]],
        type: item.type!,
        description: item.description,
        conditionText: item.conditionText,
        priority: item.priority,
        sourceDocumentId,
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
        technicalCaseId,
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
          sourceDocumentId,
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
          technicalCaseId,
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
          sourceDocumentId,
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
          technicalCaseId,
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
          sourceDocumentId,
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
          technicalCaseId,
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
          sourceDocumentId,
          sourcePage: item.sourcePage,
        };
      }),
    });
  }
}
