import type { Prisma } from "@/generated/prisma/client";
import type { AutomotiveExtractionDraft } from "@/lib/extraction/automotive-draft-schema";

const technicalCaseEditInclude = {
  sources: {
    orderBy: { isPrimary: "desc" as const },
    include: {
      sourceDocument: {
        select: {
          id: true,
          originalFilename: true,
          title: true,
          bulletinReference: true,
          publisher: true,
          language: true,
          pageCount: true,
          claimedPageCount: true,
        },
      },
    },
  },
  applicability: { orderBy: { id: "asc" as const } },
  faultCodes: { orderBy: { id: "asc" as const } },
  symptoms: { orderBy: { id: "asc" as const } },
  components: { orderBy: { id: "asc" as const } },
  causes: { orderBy: [{ priority: "asc" as const }, { id: "asc" as const }] },
  solutions: {
    orderBy: [{ priority: "asc" as const }, { id: "asc" as const }],
  },
  procedures: {
    orderBy: { position: "asc" as const },
    include: { steps: { orderBy: { position: "asc" as const } } },
  },
  measurementSpecs: { orderBy: { id: "asc" as const } },
  notes: { orderBy: { id: "asc" as const } },
  parts: { orderBy: { partNumber: "asc" as const } },
  media: {
    select: { id: true, componentId: true, procedureStepId: true },
  },
} satisfies Prisma.TechnicalCaseInclude;

export type TechnicalCaseEditRecord = Prisma.TechnicalCaseGetPayload<{
  include: typeof technicalCaseEditInclude;
}>;

export function technicalCaseEditQuery(caseId: string) {
  return {
    where: { id: caseId },
    include: technicalCaseEditInclude,
  };
}

function decimalValue(value: { toString(): string } | null) {
  return value === null ? null : Number(value.toString());
}

export function technicalCaseToEditDraft(
  technicalCase: TechnicalCaseEditRecord,
): {
  draft: AutomotiveExtractionDraft;
  sourceDocumentId: string | null;
  originalFilename: string;
  maxSourcePage: number | null;
} {
  const primarySource =
    technicalCase.sources.find((source) => source.isPrimary) ??
    technicalCase.sources[0] ??
    null;
  const sourceDocument = primarySource?.sourceDocument ?? null;
  const applicabilityReferences = new Map(
    technicalCase.applicability.map((item, index) => [
      item.id,
      `applicability-${index + 1}`,
    ]),
  );
  const componentReferences = new Map(
    technicalCase.components.map((item, index) => [
      item.id,
      `component-${index + 1}`,
    ]),
  );
  const stepReferences = new Map<string, string>();

  technicalCase.procedures.forEach((procedure, procedureIndex) => {
    procedure.steps.forEach((step, stepIndex) => {
      stepReferences.set(
        step.id,
        `procedure-${procedureIndex + 1}-step-${stepIndex + 1}`,
      );
    });
  });

  return {
    sourceDocumentId: sourceDocument?.id ?? null,
    originalFilename: sourceDocument?.originalFilename ?? technicalCase.title,
    maxSourcePage:
      sourceDocument?.pageCount ?? sourceDocument?.claimedPageCount ?? null,
    draft: {
      document: {
        detectedTitle: sourceDocument?.title ?? null,
        bulletinReference: sourceDocument?.bulletinReference ?? null,
        publisher: sourceDocument?.publisher ?? null,
        language: sourceDocument?.language ?? null,
        claimedPageCount:
          sourceDocument?.pageCount ?? sourceDocument?.claimedPageCount ?? null,
        completenessNotes: null,
      },
      cases: [
        {
          title: technicalCase.title,
          summary: technicalCase.summary,
          problemDescription: technicalCase.problemDescription,
          primarySystem: technicalCase.primarySystem,
          applicability: technicalCase.applicability.map((item) => ({
            reference: applicabilityReferences.get(item.id)!,
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
            sourcePage: item.sourcePage,
          })),
          faultCodes: technicalCase.faultCodes.map((item) => ({
            rawCode: item.rawCode,
            normalizedCode: item.normalizedCode,
            manufacturerCode: item.manufacturerCode,
            description: item.description,
            role: item.role,
            controlModule: item.controlModule,
            sourcePage: item.sourcePage,
          })),
          symptoms: technicalCase.symptoms.map((item) => ({
            label: item.label,
            normalizedLabel: item.normalizedLabel,
            details: item.details,
            operatingCondition: item.operatingCondition,
            sourcePage: item.sourcePage,
          })),
          components: technicalCase.components.map((item) => ({
            reference: componentReferences.get(item.id)!,
            name: item.name,
            normalizedName: item.normalizedName,
            manufacturerIdentifier: item.manufacturerIdentifier,
            system: item.system,
            role: item.role,
            sourcePage: item.sourcePage,
          })),
          causes: technicalCase.causes.map((item) => ({
            description: item.description,
            componentReference: item.componentId
              ? (componentReferences.get(item.componentId) ?? null)
              : null,
            category: item.category,
            certainty:
              item.certainty === "PROBABLE" ? "LIKELY" : item.certainty,
            priority: item.priority,
            conditionText: item.conditionText,
            sourcePage: item.sourcePage,
          })),
          solutions: technicalCase.solutions.map((item) => ({
            type: item.type,
            description: item.description,
            componentReference: item.componentId
              ? (componentReferences.get(item.componentId) ?? null)
              : null,
            conditionText: item.conditionText,
            priority: item.priority,
            sourcePage: item.sourcePage,
          })),
          procedures: technicalCase.procedures.map((procedure) => ({
            type: procedure.type,
            title: procedure.title,
            description: procedure.description,
            position: procedure.position,
            steps: procedure.steps.map((step) => ({
              reference: stepReferences.get(step.id)!,
              position: step.position,
              instruction: step.instruction,
              precondition: step.precondition,
              expectedResult: step.expectedResult,
              ifPass: step.ifPass,
              ifFail: step.ifFail,
              toolsText: step.toolsText,
              componentReference: step.componentId
                ? (componentReferences.get(step.componentId) ?? null)
                : null,
              applicabilityReference: step.applicabilityId
                ? (applicabilityReferences.get(step.applicabilityId) ?? null)
                : null,
              sourcePage: step.sourcePage,
            })),
          })),
          measurements: technicalCase.measurementSpecs.map((item) => ({
            procedureStepReference: item.procedureStepId
              ? (stepReferences.get(item.procedureStepId) ?? null)
              : null,
            componentReference: item.componentId
              ? (componentReferences.get(item.componentId) ?? null)
              : null,
            applicabilityReference: item.applicabilityId
              ? (applicabilityReferences.get(item.applicabilityId) ?? null)
              : null,
            parameter: item.parameter,
            measurementType: item.measurementType,
            targetValue: decimalValue(item.targetValue),
            minValue: decimalValue(item.minValue),
            maxValue: decimalValue(item.maxValue),
            tolerancePlus: decimalValue(item.tolerancePlus),
            toleranceMinus: decimalValue(item.toleranceMinus),
            unit: item.unit,
            expectedText: item.expectedText,
            conditionText: item.conditionText,
            durationSeconds: item.durationSeconds,
            repeatCount: item.repeatCount,
            isApproximate: item.isApproximate,
            isExample: item.isExample,
            sourcePage: item.sourcePage,
          })),
          notes: technicalCase.notes.map((item) => ({
            procedureStepReference: item.procedureStepId
              ? (stepReferences.get(item.procedureStepId) ?? null)
              : null,
            applicabilityReference: item.applicabilityId
              ? (applicabilityReferences.get(item.applicabilityId) ?? null)
              : null,
            type: item.type,
            text: item.text,
            externalReference: item.externalReference,
            sourcePage: item.sourcePage,
          })),
          parts: technicalCase.parts.map((item) => ({
            componentReference: item.componentId
              ? (componentReferences.get(item.componentId) ?? null)
              : null,
            applicabilityReference: item.applicabilityId
              ? (applicabilityReferences.get(item.applicabilityId) ?? null)
              : null,
            partNumber: item.partNumber,
            description: item.description,
            role: item.role,
            vinVerificationRequired: item.vinVerificationRequired,
            sourcePage: item.sourcePage,
          })),
        },
      ],
    },
  };
}
