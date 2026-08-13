import { z } from "zod";

const nullableText = z.string().nullable();
const nullableInteger = z.number().int().nullable();
const nullableNumber = z.number().nullable();
const sourcePage = z.number().int().positive().nullable();

const applicabilitySchema = z.object({
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
    language: nullableText,
    claimedPageCount: nullableInteger,
    completenessNotes: nullableText,
  }),
  cases: z.array(technicalCaseSchema),
});

export type AutomotiveExtractionDraft = z.infer<
  typeof automotiveExtractionDraftSchema
>;

export function validateAutomotiveExtractionDraft(value: unknown) {
  return automotiveExtractionDraftSchema.parse(value);
}
