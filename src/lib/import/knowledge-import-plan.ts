import type { AutomotiveExtractionDraft } from "../extraction/automotive-draft-schema";

export type ImportValidationCode =
  | "NO_CASES"
  | "CASE_TITLE_REQUIRED"
  | "FAULT_CODE_REQUIRED"
  | "INVALID_YEAR_RANGE"
  | "INVALID_MEASUREMENT_RANGE"
  | "MEASUREMENT_PARAMETER_REQUIRED"
  | "MEASUREMENT_UNIT_REQUIRED"
  | "DUPLICATE_PROCEDURE_POSITION"
  | "DUPLICATE_STEP_POSITION"
  | "UNRESOLVED_COMPONENT_REFERENCE"
  | "UNRESOLVED_APPLICABILITY_REFERENCE"
  | "UNRESOLVED_STEP_REFERENCE"
  | "AMBIGUOUS_REFERENCE"
  | "PART_NUMBER_REQUIRED"
  | "SOLUTION_TYPE_REQUIRED"
  | "REQUIRED_TEXT_MISSING"
  | "INVALID_SOURCE_PAGE";

export type ImportValidationIssue = {
  code: ImportValidationCode;
  path: string;
  reference?: string;
};

export class KnowledgeImportValidationError extends Error {
  constructor(readonly issues: ImportValidationIssue[]) {
    super("The reviewed extraction draft is not valid for import.");
    this.name = "KnowledgeImportValidationError";
  }
}

type ResolvedReference = number | null;

export type CaseReferencePlan = {
  causeComponents: ResolvedReference[];
  solutionComponents: ResolvedReference[];
  steps: Array<
    Array<{
      component: ResolvedReference;
      applicability: ResolvedReference;
    }>
  >;
  measurements: Array<{
    procedureStep: { procedure: number; step: number } | null;
    component: ResolvedReference;
    applicability: ResolvedReference;
  }>;
  notes: Array<{
    procedureStep: { procedure: number; step: number } | null;
    applicability: ResolvedReference;
  }>;
  parts: Array<{
    component: ResolvedReference;
    applicability: ResolvedReference;
  }>;
};

export type KnowledgeImportPlan = {
  draft: AutomotiveExtractionDraft;
  references: CaseReferencePlan[];
};

type ReferenceEntry<T> = { index: T; values: string[] };

function text(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function referenceKey(value: string) {
  return value.trim().toLocaleLowerCase("en-US");
}

function uniqueValues(values: Array<string | null | undefined>) {
  return [
    ...new Set(values.map(text).filter((value): value is string => !!value)),
  ];
}

function resolveReference<T>(
  reference: string | null | undefined,
  entries: Array<ReferenceEntry<T>>,
  path: string,
  unresolvedCode:
    | "UNRESOLVED_COMPONENT_REFERENCE"
    | "UNRESOLVED_APPLICABILITY_REFERENCE"
    | "UNRESOLVED_STEP_REFERENCE",
  issues: ImportValidationIssue[],
): T | null {
  const value = text(reference);
  if (!value) return null;

  const key = referenceKey(value);
  const matches = entries.filter((entry) =>
    entry.values.some((candidate) => referenceKey(candidate) === key),
  );

  if (matches.length === 1) return matches[0].index;

  issues.push({
    code: matches.length === 0 ? unresolvedCode : "AMBIGUOUS_REFERENCE",
    path,
    reference: value,
  });
  return null;
}

function validateSourcePage(
  value: number | null,
  path: string,
  maxSourcePage: number | null,
  issues: ImportValidationIssue[],
) {
  if (
    value !== null &&
    (!Number.isInteger(value) ||
      value < 1 ||
      (maxSourcePage !== null && value > maxSourcePage))
  ) {
    issues.push({ code: "INVALID_SOURCE_PAGE", path });
  }
}

function validateRequiredText(
  value: string,
  path: string,
  issues: ImportValidationIssue[],
) {
  if (!text(value)) issues.push({ code: "REQUIRED_TEXT_MISSING", path });
}

export function buildKnowledgeImportPlan(
  draft: AutomotiveExtractionDraft,
  options: { maxSourcePage?: number | null } = {},
): KnowledgeImportPlan {
  const issues: ImportValidationIssue[] = [];
  const maxSourcePage = options.maxSourcePage ?? null;
  const references: CaseReferencePlan[] = [];

  if (draft.cases.length === 0) {
    issues.push({ code: "NO_CASES", path: "cases" });
  }

  draft.cases.forEach((technicalCase, caseIndex) => {
    const casePath = `cases[${caseIndex}]`;
    if (!text(technicalCase.title)) {
      issues.push({ code: "CASE_TITLE_REQUIRED", path: `${casePath}.title` });
    }

    const applicabilityEntries = technicalCase.applicability.map(
      (item, index): ReferenceEntry<number> => ({
        index,
        values: uniqueValues([
          item.reference,
          item.engineCode,
          item.engineCodePattern,
          item.model,
          item.generationOrPlatform,
          [item.brand, item.model, item.generationOrPlatform, item.engineCode]
            .filter(Boolean)
            .join(" "),
        ]),
      }),
    );
    const componentEntries = technicalCase.components.map(
      (item, index): ReferenceEntry<number> => ({
        index,
        values: uniqueValues([
          item.reference,
          item.name,
          item.normalizedName,
          item.manufacturerIdentifier,
        ]),
      }),
    );
    const stepEntries: Array<
      ReferenceEntry<{ procedure: number; step: number }>
    > = [];

    const procedurePositions = new Set<number>();
    technicalCase.procedures.forEach((procedure, procedureIndex) => {
      const procedurePath = `${casePath}.procedures[${procedureIndex}]`;
      if (procedurePositions.has(procedure.position)) {
        issues.push({
          code: "DUPLICATE_PROCEDURE_POSITION",
          path: `${procedurePath}.position`,
        });
      }
      procedurePositions.add(procedure.position);
      validateRequiredText(procedure.title, `${procedurePath}.title`, issues);

      const stepPositions = new Set<number>();
      procedure.steps.forEach((step, stepIndex) => {
        const stepPath = `${procedurePath}.steps[${stepIndex}]`;
        if (stepPositions.has(step.position)) {
          issues.push({
            code: "DUPLICATE_STEP_POSITION",
            path: `${stepPath}.position`,
          });
        }
        stepPositions.add(step.position);
        validateRequiredText(
          step.instruction,
          `${stepPath}.instruction`,
          issues,
        );
        validateSourcePage(
          step.sourcePage,
          `${stepPath}.sourcePage`,
          maxSourcePage,
          issues,
        );
        stepEntries.push({
          index: { procedure: procedureIndex, step: stepIndex },
          values: uniqueValues([
            step.reference,
            `${procedure.position}.${step.position}`,
          ]),
        });
      });
    });

    technicalCase.applicability.forEach((item, index) => {
      const path = `${casePath}.applicability[${index}]`;
      if (
        item.yearFrom !== null &&
        item.yearTo !== null &&
        item.yearFrom > item.yearTo
      ) {
        issues.push({ code: "INVALID_YEAR_RANGE", path });
      }
      validateSourcePage(
        item.sourcePage,
        `${path}.sourcePage`,
        maxSourcePage,
        issues,
      );
    });

    technicalCase.faultCodes.forEach((item, index) => {
      const path = `${casePath}.faultCodes[${index}]`;
      if (!text(item.rawCode)) {
        issues.push({ code: "FAULT_CODE_REQUIRED", path: `${path}.rawCode` });
      }
      validateSourcePage(
        item.sourcePage,
        `${path}.sourcePage`,
        maxSourcePage,
        issues,
      );
    });

    technicalCase.symptoms.forEach((item, index) => {
      const path = `${casePath}.symptoms[${index}]`;
      validateRequiredText(item.label, `${path}.label`, issues);
      validateSourcePage(
        item.sourcePage,
        `${path}.sourcePage`,
        maxSourcePage,
        issues,
      );
    });
    technicalCase.components.forEach((item, index) => {
      const path = `${casePath}.components[${index}]`;
      validateRequiredText(item.name, `${path}.name`, issues);
      validateSourcePage(
        item.sourcePage,
        `${path}.sourcePage`,
        maxSourcePage,
        issues,
      );
    });

    const causeComponents = technicalCase.causes.map((item, index) => {
      const path = `${casePath}.causes[${index}]`;
      validateRequiredText(item.description, `${path}.description`, issues);
      validateSourcePage(
        item.sourcePage,
        `${path}.sourcePage`,
        maxSourcePage,
        issues,
      );
      return resolveReference(
        item.componentReference,
        componentEntries,
        `${path}.componentReference`,
        "UNRESOLVED_COMPONENT_REFERENCE",
        issues,
      );
    });
    const solutionComponents = technicalCase.solutions.map((item, index) => {
      const path = `${casePath}.solutions[${index}]`;
      validateRequiredText(item.description, `${path}.description`, issues);
      if (!item.type) {
        issues.push({ code: "SOLUTION_TYPE_REQUIRED", path: `${path}.type` });
      }
      validateSourcePage(
        item.sourcePage,
        `${path}.sourcePage`,
        maxSourcePage,
        issues,
      );
      return resolveReference(
        item.componentReference,
        componentEntries,
        `${path}.componentReference`,
        "UNRESOLVED_COMPONENT_REFERENCE",
        issues,
      );
    });

    const steps = technicalCase.procedures.map((procedure, procedureIndex) =>
      procedure.steps.map((step, stepIndex) => {
        const path = `${casePath}.procedures[${procedureIndex}].steps[${stepIndex}]`;
        return {
          component: resolveReference(
            step.componentReference,
            componentEntries,
            `${path}.componentReference`,
            "UNRESOLVED_COMPONENT_REFERENCE",
            issues,
          ),
          applicability: resolveReference(
            step.applicabilityReference,
            applicabilityEntries,
            `${path}.applicabilityReference`,
            "UNRESOLVED_APPLICABILITY_REFERENCE",
            issues,
          ),
        };
      }),
    );

    const measurements = technicalCase.measurements.map((item, index) => {
      const path = `${casePath}.measurements[${index}]`;
      const specificationNumbers = [
        item.targetValue,
        item.minValue,
        item.maxValue,
        item.tolerancePlus,
        item.toleranceMinus,
      ];
      const hasSpecificationNumber = specificationNumbers.some(
        (value) => value !== null,
      );
      const hasAnyNumber =
        hasSpecificationNumber ||
        item.durationSeconds !== null ||
        item.repeatCount !== null;

      if (hasAnyNumber && !text(item.parameter)) {
        issues.push({
          code: "MEASUREMENT_PARAMETER_REQUIRED",
          path: `${path}.parameter`,
        });
      } else {
        validateRequiredText(item.parameter, `${path}.parameter`, issues);
      }
      if (hasSpecificationNumber && !text(item.unit)) {
        issues.push({
          code: "MEASUREMENT_UNIT_REQUIRED",
          path: `${path}.unit`,
        });
      }
      if (
        item.minValue !== null &&
        item.maxValue !== null &&
        item.minValue > item.maxValue
      ) {
        issues.push({ code: "INVALID_MEASUREMENT_RANGE", path });
      }
      validateSourcePage(
        item.sourcePage,
        `${path}.sourcePage`,
        maxSourcePage,
        issues,
      );
      return {
        procedureStep: resolveReference(
          item.procedureStepReference,
          stepEntries,
          `${path}.procedureStepReference`,
          "UNRESOLVED_STEP_REFERENCE",
          issues,
        ),
        component: resolveReference(
          item.componentReference,
          componentEntries,
          `${path}.componentReference`,
          "UNRESOLVED_COMPONENT_REFERENCE",
          issues,
        ),
        applicability: resolveReference(
          item.applicabilityReference,
          applicabilityEntries,
          `${path}.applicabilityReference`,
          "UNRESOLVED_APPLICABILITY_REFERENCE",
          issues,
        ),
      };
    });

    const notes = technicalCase.notes.map((item, index) => {
      const path = `${casePath}.notes[${index}]`;
      validateRequiredText(item.text, `${path}.text`, issues);
      validateSourcePage(
        item.sourcePage,
        `${path}.sourcePage`,
        maxSourcePage,
        issues,
      );
      return {
        procedureStep: resolveReference(
          item.procedureStepReference,
          stepEntries,
          `${path}.procedureStepReference`,
          "UNRESOLVED_STEP_REFERENCE",
          issues,
        ),
        applicability: resolveReference(
          item.applicabilityReference,
          applicabilityEntries,
          `${path}.applicabilityReference`,
          "UNRESOLVED_APPLICABILITY_REFERENCE",
          issues,
        ),
      };
    });

    const parts = technicalCase.parts.map((item, index) => {
      const path = `${casePath}.parts[${index}]`;
      if (!text(item.partNumber)) {
        issues.push({
          code: "PART_NUMBER_REQUIRED",
          path: `${path}.partNumber`,
        });
      }
      validateSourcePage(
        item.sourcePage,
        `${path}.sourcePage`,
        maxSourcePage,
        issues,
      );
      return {
        component: resolveReference(
          item.componentReference,
          componentEntries,
          `${path}.componentReference`,
          "UNRESOLVED_COMPONENT_REFERENCE",
          issues,
        ),
        applicability: resolveReference(
          item.applicabilityReference,
          applicabilityEntries,
          `${path}.applicabilityReference`,
          "UNRESOLVED_APPLICABILITY_REFERENCE",
          issues,
        ),
      };
    });

    references.push({
      causeComponents,
      solutionComponents,
      steps,
      measurements,
      notes,
      parts,
    });
  });

  if (issues.length > 0) throw new KnowledgeImportValidationError(issues);
  return { draft, references };
}
