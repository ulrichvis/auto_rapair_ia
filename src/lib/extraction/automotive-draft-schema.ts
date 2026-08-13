import { z } from "zod";

const nullableText = z.string().nullable();
const nullableInteger = z.number().int().nullable();
const nullableNumber = z.number().nullable();
const sourcePage = z.number().int().positive().nullable();
const sourceLanguage = nullableText.describe(
  "Main source PDF language as a standard short code when practical, such as it, fr, de, or en.",
);

const applicabilitySchema = z.object({
  reference: nullableText,
  brand: nullableText,
  model: nullableText,
  generationOrPlatform: nullableText,
  yearFrom: nullableInteger,
  yearTo: nullableInteger,
  engineLabel: nullableText,
  engineFamily: nullableText,
  engineCode: nullableText,
  engineCodePattern: nullableText,
  engineMatchType: z
    .enum(["EXACT", "PREFIX", "PATTERN", "FAMILY", "ALL"])
    .nullable(),
  fuelType: nullableText,
  transmission: nullableText,
  variantNotes: nullableText,
  sourcePage,
});

const faultCodeSchema = z.object({
  rawCode: z.string(),
  normalizedCode: nullableText,
  manufacturerCode: nullableText,
  description: nullableText,
  role: z.enum(["PRIMARY", "RELATED", "CONSEQUENTIAL"]).nullable(),
  controlModule: nullableText,
  sourcePage,
});

const symptomSchema = z.object({
  label: z.string(),
  normalizedLabel: nullableText,
  details: nullableText,
  operatingCondition: nullableText,
  sourcePage,
});

const componentSchema = z.object({
  reference: nullableText,
  name: z.string(),
  normalizedName: nullableText,
  manufacturerIdentifier: nullableText,
  system: nullableText,
  role: nullableText,
  sourcePage,
});

const causeSchema = z.object({
  description: z.string(),
  componentReference: nullableText,
  category: nullableText,
  certainty: z.enum(["POSSIBLE", "LIKELY", "CONFIRMED"]),
  priority: nullableInteger,
  conditionText: nullableText,
  sourcePage,
});

const solutionSchema = z.object({
  type: z
    .enum([
      "REPAIR",
      "REPLACE",
      "CLEAN",
      "ADJUST",
      "CALIBRATE",
      "SOFTWARE_UPDATE",
      "REGENERATE",
      "RESET",
      "OTHER",
    ])
    .nullable(),
  description: z.string(),
  componentReference: nullableText,
  conditionText: nullableText,
  priority: nullableInteger,
  sourcePage,
});

const procedureStepSchema = z.object({
  reference: nullableText,
  position: z.number().int().positive(),
  instruction: z.string(),
  precondition: nullableText,
  expectedResult: nullableText,
  ifPass: nullableText,
  ifFail: nullableText,
  toolsText: nullableText,
  componentReference: nullableText,
  applicabilityReference: nullableText,
  sourcePage,
});

const procedureSchema = z.object({
  type: z.enum(["DIAGNOSTIC", "REPAIR", "CALIBRATION", "VERIFICATION"]),
  title: z.string(),
  description: nullableText,
  position: z.number().int().positive(),
  steps: z.array(procedureStepSchema),
});

const measurementSchema = z.object({
  procedureStepReference: nullableText,
  componentReference: nullableText,
  applicabilityReference: nullableText,
  parameter: z.string(),
  measurementType: nullableText,
  targetValue: nullableNumber,
  minValue: nullableNumber,
  maxValue: nullableNumber,
  tolerancePlus: nullableNumber,
  toleranceMinus: nullableNumber,
  unit: nullableText,
  expectedText: nullableText,
  conditionText: nullableText,
  durationSeconds: nullableInteger,
  repeatCount: nullableInteger,
  isApproximate: z.boolean(),
  isExample: z.boolean(),
  sourcePage,
});

const noteSchema = z.object({
  procedureStepReference: nullableText,
  applicabilityReference: nullableText,
  type: z.enum([
    "GENERAL",
    "WARNING",
    "LIMITATION",
    "EXCEPTION",
    "VARIANT",
    "TECHNICAL",
  ]),
  text: z.string(),
  externalReference: nullableText,
  sourcePage,
});

const partSchema = z.object({
  componentReference: nullableText,
  applicabilityReference: nullableText,
  partNumber: z.string(),
  description: nullableText,
  role: nullableText,
  vinVerificationRequired: z.boolean(),
  sourcePage,
});

const technicalCaseSchema = z.object({
  title: z.string(),
  summary: nullableText,
  problemDescription: nullableText,
  primarySystem: nullableText,
  applicability: z.array(applicabilitySchema),
  faultCodes: z.array(faultCodeSchema),
  symptoms: z.array(symptomSchema),
  components: z.array(componentSchema),
  causes: z.array(causeSchema),
  solutions: z.array(solutionSchema),
  procedures: z.array(procedureSchema),
  measurements: z.array(measurementSchema),
  notes: z.array(noteSchema),
  parts: z.array(partSchema),
});

export const automotiveExtractionDraftSchema = z.object({
  document: z.object({
    detectedTitle: nullableText,
    bulletinReference: nullableText,
    publisher: nullableText,
    language: sourceLanguage,
    claimedPageCount: nullableInteger,
    completenessNotes: nullableText,
  }),
  cases: z.array(technicalCaseSchema),
});

export type AutomotiveExtractionDraft = z.infer<
  typeof automotiveExtractionDraftSchema
>;

function addReferenceDefaults(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  const draft = value as Record<string, unknown>;
  if (!Array.isArray(draft.cases)) return value;

  return {
    ...draft,
    cases: draft.cases.map((caseValue) => {
      if (!caseValue || typeof caseValue !== "object") return caseValue;
      const technicalCase = caseValue as Record<string, unknown>;
      const addDefault = (item: unknown, fields: string[]) => {
        if (!item || typeof item !== "object") return item;
        const record = item as Record<string, unknown>;
        return Object.fromEntries([
          ...Object.entries(record),
          ...fields
            .filter((field) => !(field in record))
            .map((field) => [field, null]),
        ]);
      };
      const mapItems = (key: string, fields: string[]) =>
        Array.isArray(technicalCase[key])
          ? (technicalCase[key] as unknown[]).map((item) =>
              addDefault(item, fields),
            )
          : technicalCase[key];

      return {
        ...technicalCase,
        applicability: mapItems("applicability", ["reference"]),
        components: mapItems("components", ["reference"]),
        procedures: Array.isArray(technicalCase.procedures)
          ? technicalCase.procedures.map((procedureValue) => {
              if (!procedureValue || typeof procedureValue !== "object") {
                return procedureValue;
              }
              const procedure = procedureValue as Record<string, unknown>;
              return {
                ...procedure,
                steps: Array.isArray(procedure.steps)
                  ? procedure.steps.map((step) =>
                      addDefault(step, ["reference"]),
                    )
                  : procedure.steps,
              };
            })
          : technicalCase.procedures,
        measurements: mapItems("measurements", [
          "procedureStepReference",
          "componentReference",
          "applicabilityReference",
        ]),
        notes: mapItems("notes", [
          "procedureStepReference",
          "applicabilityReference",
        ]),
        parts: mapItems("parts", [
          "componentReference",
          "applicabilityReference",
        ]),
      };
    }),
  };
}

export function validateAutomotiveExtractionDraft(value: unknown) {
  return automotiveExtractionDraftSchema.parse(addReferenceDefaults(value));
}
