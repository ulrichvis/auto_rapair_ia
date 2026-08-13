"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import type { AutomotiveExtractionDraft } from "@/lib/extraction/automotive-draft-schema";

type DraftCase = AutomotiveExtractionDraft["cases"][number];
type Applicability = DraftCase["applicability"][number];
type FaultCode = DraftCase["faultCodes"][number];
type Symptom = DraftCase["symptoms"][number];
type Component = DraftCase["components"][number];
type Cause = DraftCase["causes"][number];
type Solution = DraftCase["solutions"][number];
type Procedure = DraftCase["procedures"][number];
type ProcedureStep = Procedure["steps"][number];
type Measurement = DraftCase["measurements"][number];
type Note = DraftCase["notes"][number];
type Part = DraftCase["parts"][number];

type EditableValue = string | number | boolean | null;
type FieldDefinition = {
  key: string;
  labelKey: string;
  kind?: "text" | "textarea" | "number" | "checkbox" | "select";
  options?: readonly string[];
  required?: boolean;
  internal?: boolean;
};
type Warning = { key: string; tone?: "danger" | "warning" };

const sourcePageField: FieldDefinition = {
  key: "sourcePage",
  labelKey: "sourcePage",
  kind: "number",
};

const applicabilityFields: FieldDefinition[] = [
  { key: "brand", labelKey: "brand" },
  { key: "model", labelKey: "model" },
  { key: "generationOrPlatform", labelKey: "generationOrPlatform" },
  { key: "yearFrom", labelKey: "yearFrom", kind: "number" },
  { key: "yearTo", labelKey: "yearTo", kind: "number" },
  { key: "engineLabel", labelKey: "engineLabel" },
  { key: "engineFamily", labelKey: "engineFamily" },
  { key: "engineCode", labelKey: "engineCode" },
  { key: "engineCodePattern", labelKey: "engineCodePattern" },
  {
    key: "engineMatchType",
    labelKey: "engineMatchType",
    kind: "select",
    options: ["EXACT", "PREFIX", "PATTERN", "FAMILY", "ALL"],
  },
  { key: "fuelType", labelKey: "fuelType" },
  { key: "transmission", labelKey: "transmission" },
  { key: "variantNotes", labelKey: "variantNotes", kind: "textarea" },
  sourcePageField,
];

const faultCodeFields: FieldDefinition[] = [
  { key: "rawCode", labelKey: "rawCode", required: true },
  { key: "normalizedCode", labelKey: "normalizedCode", internal: true },
  { key: "manufacturerCode", labelKey: "manufacturerCode" },
  { key: "description", labelKey: "description", kind: "textarea" },
  {
    key: "role",
    labelKey: "dtcRole",
    kind: "select",
    options: ["PRIMARY", "RELATED", "CONSEQUENTIAL"],
  },
  { key: "controlModule", labelKey: "controlModule" },
  sourcePageField,
];

const symptomFields: FieldDefinition[] = [
  { key: "label", labelKey: "symptom", required: true },
  { key: "normalizedLabel", labelKey: "normalizedSymptom", internal: true },
  { key: "details", labelKey: "details", kind: "textarea" },
  {
    key: "operatingCondition",
    labelKey: "operatingCondition",
    kind: "textarea",
  },
  sourcePageField,
];

const componentFields: FieldDefinition[] = [
  { key: "name", labelKey: "component", required: true },
  { key: "normalizedName", labelKey: "normalizedName", internal: true },
  { key: "manufacturerIdentifier", labelKey: "manufacturerIdentifier" },
  { key: "system", labelKey: "system" },
  { key: "role", labelKey: "role" },
  sourcePageField,
];

const causeFields: FieldDefinition[] = [
  { key: "description", labelKey: "cause", kind: "textarea", required: true },
  { key: "componentReference", labelKey: "componentReference" },
  { key: "category", labelKey: "category" },
  {
    key: "certainty",
    labelKey: "causeCertainty",
    kind: "select",
    options: ["POSSIBLE", "LIKELY", "CONFIRMED"],
    required: true,
  },
  { key: "priority", labelKey: "priority", kind: "number" },
  {
    key: "conditionText",
    labelKey: "conditionText",
    kind: "textarea",
  },
  sourcePageField,
];

const solutionFields: FieldDefinition[] = [
  {
    key: "type",
    labelKey: "actionType",
    kind: "select",
    options: [
      "REPAIR",
      "REPLACE",
      "CLEAN",
      "ADJUST",
      "CALIBRATE",
      "SOFTWARE_UPDATE",
      "REGENERATE",
      "RESET",
      "OTHER",
    ],
  },
  {
    key: "description",
    labelKey: "solution",
    kind: "textarea",
    required: true,
  },
  { key: "componentReference", labelKey: "componentReference" },
  {
    key: "conditionText",
    labelKey: "conditionText",
    kind: "textarea",
  },
  { key: "priority", labelKey: "priority", kind: "number" },
  sourcePageField,
];

const procedureFields: FieldDefinition[] = [
  {
    key: "type",
    labelKey: "procedureType",
    kind: "select",
    options: ["DIAGNOSTIC", "REPAIR", "CALIBRATION", "VERIFICATION"],
    required: true,
  },
  { key: "title", labelKey: "procedureTitle", required: true },
  { key: "description", labelKey: "procedureDescription", kind: "textarea" },
  {
    key: "position",
    labelKey: "procedureOrder",
    kind: "number",
    required: true,
  },
];

const stepFields: FieldDefinition[] = [
  { key: "position", labelKey: "stepOrder", kind: "number", required: true },
  {
    key: "instruction",
    labelKey: "instruction",
    kind: "textarea",
    required: true,
  },
  {
    key: "precondition",
    labelKey: "precondition",
    kind: "textarea",
  },
  { key: "expectedResult", labelKey: "expectedResult", kind: "textarea" },
  { key: "ifPass", labelKey: "ifPass", kind: "textarea" },
  { key: "ifFail", labelKey: "ifFail", kind: "textarea" },
  { key: "toolsText", labelKey: "toolsText", kind: "textarea" },
  { key: "componentReference", labelKey: "componentReference" },
  { key: "applicabilityReference", labelKey: "applicabilityReference" },
  sourcePageField,
];

const measurementFields: FieldDefinition[] = [
  { key: "parameter", labelKey: "parameter", required: true },
  { key: "measurementType", labelKey: "measurementType" },
  { key: "targetValue", labelKey: "targetValue", kind: "number" },
  { key: "minValue", labelKey: "minValue", kind: "number" },
  { key: "maxValue", labelKey: "maxValue", kind: "number" },
  { key: "tolerancePlus", labelKey: "tolerancePlus", kind: "number" },
  { key: "toleranceMinus", labelKey: "toleranceMinus", kind: "number" },
  { key: "unit", labelKey: "unit" },
  {
    key: "expectedText",
    labelKey: "expectedText",
    kind: "textarea",
  },
  {
    key: "conditionText",
    labelKey: "measurementCondition",
    kind: "textarea",
  },
  { key: "durationSeconds", labelKey: "durationSeconds", kind: "number" },
  { key: "repeatCount", labelKey: "repeatCount", kind: "number" },
  { key: "isApproximate", labelKey: "isApproximate", kind: "checkbox" },
  { key: "isExample", labelKey: "isExample", kind: "checkbox" },
  sourcePageField,
];

const noteFields: FieldDefinition[] = [
  {
    key: "type",
    labelKey: "noteType",
    kind: "select",
    options: [
      "GENERAL",
      "WARNING",
      "LIMITATION",
      "EXCEPTION",
      "VARIANT",
      "TECHNICAL",
    ],
    required: true,
  },
  { key: "text", labelKey: "noteText", kind: "textarea", required: true },
  { key: "externalReference", labelKey: "externalReference" },
  sourcePageField,
];

const partFields: FieldDefinition[] = [
  { key: "partNumber", labelKey: "partNumber", required: true },
  { key: "description", labelKey: "partDescription", kind: "textarea" },
  { key: "role", labelKey: "partRole" },
  {
    key: "vinVerificationRequired",
    labelKey: "vinVerificationRequired",
    kind: "checkbox",
  },
  sourcePageField,
];

const emptyApplicability: Applicability = {
  brand: null,
  model: null,
  generationOrPlatform: null,
  yearFrom: null,
  yearTo: null,
  engineLabel: null,
  engineFamily: null,
  engineCode: null,
  engineCodePattern: null,
  engineMatchType: null,
  fuelType: null,
  transmission: null,
  variantNotes: null,
  sourcePage: null,
};
const emptyFaultCode: FaultCode = {
  rawCode: "",
  normalizedCode: null,
  manufacturerCode: null,
  description: null,
  role: "PRIMARY",
  controlModule: null,
  sourcePage: null,
};
const emptySymptom: Symptom = {
  label: "",
  normalizedLabel: null,
  details: null,
  operatingCondition: null,
  sourcePage: null,
};
const emptyComponent: Component = {
  name: "",
  normalizedName: null,
  manufacturerIdentifier: null,
  system: null,
  role: null,
  sourcePage: null,
};
const emptyCause: Cause = {
  description: "",
  componentReference: null,
  category: null,
  certainty: "POSSIBLE",
  priority: null,
  conditionText: null,
  sourcePage: null,
};
const emptySolution: Solution = {
  type: null,
  description: "",
  componentReference: null,
  conditionText: null,
  priority: null,
  sourcePage: null,
};
const emptyMeasurement: Measurement = {
  parameter: "",
  measurementType: null,
  targetValue: null,
  minValue: null,
  maxValue: null,
  tolerancePlus: null,
  toleranceMinus: null,
  unit: null,
  expectedText: null,
  conditionText: null,
  durationSeconds: null,
  repeatCount: null,
  isApproximate: false,
  isExample: false,
  sourcePage: null,
};
const emptyNote: Note = {
  type: "GENERAL",
  text: "",
  externalReference: null,
  sourcePage: null,
};
const emptyPart: Part = {
  partNumber: "",
  description: null,
  role: null,
  vinVerificationRequired: false,
  sourcePage: null,
};
const emptyStep: ProcedureStep = {
  position: 1,
  instruction: "",
  precondition: null,
  expectedResult: null,
  ifPass: null,
  ifFail: null,
  toolsText: null,
  componentReference: null,
  applicabilityReference: null,
  sourcePage: null,
};

function emptyCase(): DraftCase {
  return {
    title: "",
    summary: null,
    problemDescription: null,
    primarySystem: null,
    applicability: [],
    faultCodes: [],
    symptoms: [],
    components: [],
    causes: [],
    solutions: [],
    procedures: [],
    measurements: [],
    notes: [],
    parts: [],
  };
}

function parseValue(
  field: FieldDefinition,
  value: string | boolean,
): EditableValue {
  if (field.kind === "checkbox") return Boolean(value);
  if (value === "")
    return field.required && field.kind !== "number" ? "" : null;
  if (field.kind === "number") return Number(value);
  return value;
}

function ItemFields<T extends object>({
  item,
  fields,
  onChange,
}: {
  item: T;
  fields: FieldDefinition[];
  onChange: (item: T) => void;
}) {
  const t = useTranslations("Review");
  const record = item as Record<string, EditableValue>;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {fields.map((field) => {
        const value = record[field.key];
        const sharedClass = `mt-1 w-full rounded-lg border px-3 py-2 text-sm text-slate-950 focus:outline-none focus:ring-2 ${field.internal ? "border-violet-300 bg-violet-50 focus:border-violet-500 focus:ring-violet-100" : "border-slate-300 bg-white focus:border-blue-500 focus:ring-blue-100"}`;
        const update = (nextValue: string | boolean) =>
          onChange({ ...item, [field.key]: parseValue(field, nextValue) });
        return (
          <label
            key={field.key}
            className={field.kind === "textarea" ? "md:col-span-2" : ""}
          >
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              {t(`fields.${field.labelKey}`)}
              {field.required ? " *" : ""}
              {field.internal ? (
                <span className="ml-2 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] text-violet-800 normal-case tracking-normal">
                  {t("internalKey")}
                </span>
              ) : null}
            </span>
            {field.kind === "checkbox" ? (
              <span className="mt-2 flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={Boolean(value)}
                  onChange={(event) => update(event.target.checked)}
                />{" "}
                {t("yes")}
              </span>
            ) : field.kind === "textarea" ? (
              <textarea
                rows={3}
                value={value == null ? "" : String(value)}
                onChange={(event) => update(event.target.value)}
                className={sharedClass}
              />
            ) : field.kind === "select" ? (
              <select
                value={value == null ? "" : String(value)}
                onChange={(event) => update(event.target.value)}
                className={sharedClass}
              >
                <option value="">{t("notSpecified")}</option>
                {field.options?.map((option) => (
                  <option key={option} value={option}>
                    {t(`enum.${option}`)}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type={field.kind === "number" ? "number" : "text"}
                step={field.kind === "number" ? "any" : undefined}
                value={value == null ? "" : String(value)}
                onChange={(event) => update(event.target.value)}
                className={sharedClass}
              />
            )}
          </label>
        );
      })}
    </div>
  );
}

function WarningList({ warnings }: { warnings: Warning[] }) {
  const t = useTranslations("Review");
  if (warnings.length === 0) return null;
  return (
    <div className="mb-4 space-y-2">
      {warnings.map((warning, index) => (
        <p
          key={`${warning.key}-${index}`}
          role="alert"
          className={`rounded-lg border px-3 py-2 text-sm font-medium ${warning.tone === "danger" ? "border-red-300 bg-red-50 text-red-800" : "border-amber-300 bg-amber-50 text-amber-900"}`}
        >
          {t(`warnings.${warning.key}`)}
        </p>
      ))}
    </div>
  );
}

function ArraySection<T extends object>({
  titleKey,
  items,
  fields,
  emptyItem,
  onChange,
  warningsForItem,
}: {
  titleKey: string;
  items: T[];
  fields: FieldDefinition[];
  emptyItem: T;
  onChange: (items: T[]) => void;
  warningsForItem?: (item: T) => Warning[];
}) {
  const t = useTranslations("Review");
  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50 p-5">
      <div className="flex items-center justify-between gap-4">
        <h3 className="font-semibold text-slate-950">{t(titleKey)}</h3>
        <button
          type="button"
          onClick={() => onChange([...items, structuredClone(emptyItem)])}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-100"
        >
          {t("addItem")}
        </button>
      </div>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">{t("noItems")}</p>
      ) : (
        <div className="mt-4 space-y-4">
          {items.map((item, index) => (
            <article
              key={index}
              className="rounded-xl border border-slate-200 bg-white p-4"
            >
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700">
                  {t("item", { number: index + 1 })}
                </p>
                <button
                  type="button"
                  onClick={() =>
                    onChange(
                      items.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                  className="text-sm font-medium text-red-700 hover:text-red-900"
                >
                  {t("delete")}
                </button>
              </div>
              <WarningList warnings={warningsForItem?.(item) ?? []} />
              <ItemFields
                item={item}
                fields={fields}
                onChange={(updated) =>
                  onChange(
                    items.map((current, itemIndex) =>
                      itemIndex === index ? updated : current,
                    ),
                  )
                }
              />
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function renumberSteps(steps: ProcedureStep[]) {
  return steps.map((step, index) => ({ ...step, position: index + 1 }));
}

function ProceduresSection({
  procedures,
  hasVariantScope,
  onChange,
}: {
  procedures: Procedure[];
  hasVariantScope: boolean;
  onChange: (procedures: Procedure[]) => void;
}) {
  const t = useTranslations("Review");
  function updateProcedure(index: number, procedure: Procedure) {
    onChange(
      procedures.map((current, currentIndex) =>
        currentIndex === index ? procedure : current,
      ),
    );
  }
  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50 p-5">
      <div className="flex items-center justify-between gap-4">
        <h3 className="font-semibold text-slate-950">{t("procedures")}</h3>
        <button
          type="button"
          onClick={() =>
            onChange([
              ...procedures,
              {
                type: "DIAGNOSTIC",
                title: "",
                description: null,
                position: procedures.length + 1,
                steps: [],
              },
            ])
          }
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-100"
        >
          {t("addProcedure")}
        </button>
      </div>
      {procedures.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">{t("noProcedures")}</p>
      ) : (
        <div className="mt-4 space-y-5">
          {procedures.map((procedure, procedureIndex) => (
            <article
              key={procedureIndex}
              className="rounded-xl border border-slate-200 bg-white p-4"
            >
              <div className="mb-4 flex items-center justify-between">
                <p className="font-semibold text-slate-800">
                  {t("procedure", { number: procedureIndex + 1 })}
                </p>
                <button
                  type="button"
                  onClick={() =>
                    onChange(
                      procedures
                        .filter((_, index) => index !== procedureIndex)
                        .map((item, index) => ({
                          ...item,
                          position: index + 1,
                        })),
                    )
                  }
                  className="text-sm font-medium text-red-700"
                >
                  {t("deleteProcedure")}
                </button>
              </div>
              <ItemFields
                item={procedure}
                fields={procedureFields}
                onChange={(updated) => updateProcedure(procedureIndex, updated)}
              />
              <div className="mt-5 border-t border-slate-200 pt-5">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
                    {t("procedureSteps")}
                  </h4>
                  <button
                    type="button"
                    onClick={() =>
                      updateProcedure(procedureIndex, {
                        ...procedure,
                        steps: [
                          ...procedure.steps,
                          {
                            ...emptyStep,
                            position: procedure.steps.length + 1,
                          },
                        ],
                      })
                    }
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium"
                  >
                    {t("addStep")}
                  </button>
                </div>
                <div className="mt-4 space-y-4">
                  {procedure.steps.map((step, stepIndex) => {
                    const warnings: Warning[] =
                      hasVariantScope && !step.applicabilityReference
                        ? [
                            {
                              key: "variantStepNoReference",
                            },
                          ]
                        : [];
                    return (
                      <article
                        key={stepIndex}
                        className="rounded-lg border border-slate-200 bg-slate-50 p-4"
                      >
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold">
                            {t("step", { number: stepIndex + 1 })}
                          </p>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              disabled={stepIndex === 0}
                              onClick={() => {
                                const steps = [...procedure.steps];
                                [steps[stepIndex - 1], steps[stepIndex]] = [
                                  steps[stepIndex],
                                  steps[stepIndex - 1],
                                ];
                                updateProcedure(procedureIndex, {
                                  ...procedure,
                                  steps: renumberSteps(steps),
                                });
                              }}
                              className="rounded border px-2 py-1 text-xs disabled:opacity-40"
                            >
                              {t("moveUp")}
                            </button>
                            <button
                              type="button"
                              disabled={
                                stepIndex === procedure.steps.length - 1
                              }
                              onClick={() => {
                                const steps = [...procedure.steps];
                                [steps[stepIndex], steps[stepIndex + 1]] = [
                                  steps[stepIndex + 1],
                                  steps[stepIndex],
                                ];
                                updateProcedure(procedureIndex, {
                                  ...procedure,
                                  steps: renumberSteps(steps),
                                });
                              }}
                              className="rounded border px-2 py-1 text-xs disabled:opacity-40"
                            >
                              {t("moveDown")}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                updateProcedure(procedureIndex, {
                                  ...procedure,
                                  steps: renumberSteps(
                                    procedure.steps.filter(
                                      (_, index) => index !== stepIndex,
                                    ),
                                  ),
                                })
                              }
                              className="px-2 py-1 text-xs font-medium text-red-700"
                            >
                              {t("delete")}
                            </button>
                          </div>
                        </div>
                        <WarningList warnings={warnings} />
                        <ItemFields
                          item={step}
                          fields={stepFields}
                          onChange={(updated) =>
                            updateProcedure(procedureIndex, {
                              ...procedure,
                              steps: procedure.steps.map((current, index) =>
                                index === stepIndex ? updated : current,
                              ),
                            })
                          }
                        />
                      </article>
                    );
                  })}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function applicabilityWarnings(item: Applicability): Warning[] {
  const hasScope = Boolean(
    item.brand ||
    item.model ||
    item.generationOrPlatform ||
    item.engineCode ||
    item.engineFamily ||
    item.engineLabel ||
    item.engineCodePattern,
  );
  return item.variantNotes && !hasScope
    ? [
        {
          key: "variantNoScope",
          tone: "danger",
        },
      ]
    : [];
}
function faultWarnings(item: FaultCode): Warning[] {
  return item.role === "CONSEQUENTIAL" ? [{ key: "consequentialDtc" }] : [];
}
function causeWarnings(item: Cause): Warning[] {
  return item.certainty === "CONFIRMED"
    ? [
        {
          key: "confirmedCause",
          tone: "danger",
        },
      ]
    : [];
}
function measurementWarnings(
  item: Measurement,
  hasVariantScope: boolean,
): Warning[] {
  const warnings: Warning[] = [];
  const hasNumericValue = [
    item.targetValue,
    item.minValue,
    item.maxValue,
    item.tolerancePlus,
    item.toleranceMinus,
  ].some((value) => value !== null);
  if (hasNumericValue && !item.unit?.trim())
    warnings.push({ key: "numericNoUnit", tone: "danger" });
  if (hasNumericValue && !item.parameter.trim())
    warnings.push({
      key: "numericNoParameter",
      tone: "danger",
    });
  if (
    item.minValue !== null &&
    item.maxValue !== null &&
    item.minValue > item.maxValue
  )
    warnings.push({
      key: "minGreaterMax",
      tone: "danger",
    });
  if (item.isExample)
    warnings.push({
      key: "exampleMeasurement",
    });
  if (hasVariantScope && !item.conditionText?.trim())
    warnings.push({
      key: "variantMeasurementNoCondition",
    });
  return warnings;
}

export function ReviewEditor({
  documentId,
  runId,
  originalFilename,
  initialDraft,
  completedAt,
}: {
  documentId: string;
  runId: string;
  originalFilename: string;
  initialDraft: AutomotiveExtractionDraft;
  completedAt: string | null;
}) {
  const t = useTranslations("Review");
  const locale = useLocale();
  const [draft, setDraft] = useState(initialDraft);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);
  function mutate(update: (next: AutomotiveExtractionDraft) => void) {
    setDraft((current) => {
      const next = structuredClone(current);
      update(next);
      return next;
    });
    setMessage(null);
  }
  async function saveDraft() {
    setIsSaving(true);
    setMessage(null);
    try {
      const response = await fetch(
        `/api/admin/documents/${encodeURIComponent(documentId)}/review`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ runId, draft }),
        },
      );
      const result = (await response.json()) as {
        error?: string;
        savedAt?: string;
        draft?: AutomotiveExtractionDraft;
      };
      if (!response.ok) throw new Error(result.error ?? t("saveFailed"));
      if (result.draft) setDraft(result.draft);
      const savedTime = new Intl.DateTimeFormat(locale, {
        timeStyle: "short",
      }).format(result.savedAt ? new Date(result.savedAt) : new Date());
      setMessage({
        tone: "success",
        text: t("saved", { time: savedTime }),
      });
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : t("saveFailed"),
      });
    } finally {
      setIsSaving(false);
    }
  }
  return (
    <main className="mx-auto w-full max-w-7xl px-5 py-10">
      <header className="mb-8 flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">
            {t("eyebrow")}
          </p>
          <h1 className="mt-2 break-words text-2xl font-semibold text-slate-950">
            {originalFilename}
          </h1>
          <p className="mt-3 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-800">
            {t("sourceLanguage", {
              language: draft.document.language || t("notDetected"),
            })}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            {completedAt
              ? t("latestExtraction", {
                  date: new Intl.DateTimeFormat(locale, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(completedAt)),
                })
              : t("latestExtractionNoDate")}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin/documents"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
          >
            {t("back")}
          </Link>
          <a
            href={`/api/admin/documents/${encodeURIComponent(documentId)}/pdf`}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-100"
          >
            {t("openPdf")}
          </a>
        </div>
      </header>

      <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-950">
          {t("document")}
        </h2>
        <div className="mt-5">
          <ItemFields
            item={draft.document}
            fields={[
              { key: "detectedTitle", labelKey: "detectedTitle" },
              { key: "bulletinReference", labelKey: "bulletinReference" },
              { key: "publisher", labelKey: "publisher" },
              { key: "language", labelKey: "language" },
              {
                key: "claimedPageCount",
                labelKey: "claimedPageCount",
                kind: "number",
              },
              {
                key: "completenessNotes",
                labelKey: "completenessNotes",
                kind: "textarea",
              },
            ]}
            onChange={(document) =>
              mutate((next) => {
                next.document = document;
              })
            }
          />
        </div>
      </section>

      <div className="space-y-8">
        {draft.cases.map((technicalCase, caseIndex) => {
          const hasVariantScope =
            technicalCase.applicability.some((item) =>
              Boolean(item.variantNotes),
            ) || technicalCase.notes.some((item) => item.type === "VARIANT");
          const caseWarnings: Warning[] =
            hasVariantScope && technicalCase.applicability.length === 0
              ? [
                  {
                    key: "caseVariantNoApplicability",
                    tone: "danger",
                  },
                ]
              : [];
          const replaceCase = (updated: DraftCase) =>
            mutate((next) => {
              next.cases[caseIndex] = updated;
            });
          return (
            <article
              key={caseIndex}
              className="rounded-2xl border border-slate-300 bg-white p-6 shadow-sm"
            >
              <div className="mb-6 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
                    {t("technicalCase", { number: caseIndex + 1 })}
                  </p>
                  <h2 className="mt-1 text-xl font-semibold text-slate-950">
                    {technicalCase.title || t("untitledCase")}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    mutate((next) => {
                      next.cases.splice(caseIndex, 1);
                    })
                  }
                  className="text-sm font-semibold text-red-700"
                >
                  {t("deleteCase")}
                </button>
              </div>
              <WarningList warnings={caseWarnings} />
              <div className="space-y-5">
                <section className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                  <h3 className="mb-4 font-semibold">{t("general")}</h3>
                  <ItemFields
                    item={technicalCase}
                    fields={[
                      { key: "title", labelKey: "title", required: true },
                      { key: "primarySystem", labelKey: "primarySystem" },
                      { key: "summary", labelKey: "summary", kind: "textarea" },
                      {
                        key: "problemDescription",
                        labelKey: "problemDescription",
                        kind: "textarea",
                      },
                    ]}
                    onChange={replaceCase}
                  />
                </section>
                <ArraySection
                  titleKey="applicability"
                  items={technicalCase.applicability}
                  fields={applicabilityFields}
                  emptyItem={emptyApplicability}
                  warningsForItem={applicabilityWarnings}
                  onChange={(items) =>
                    replaceCase({ ...technicalCase, applicability: items })
                  }
                />
                <ArraySection
                  titleKey="faultCodes"
                  items={technicalCase.faultCodes}
                  fields={faultCodeFields}
                  emptyItem={emptyFaultCode}
                  warningsForItem={faultWarnings}
                  onChange={(items) =>
                    replaceCase({ ...technicalCase, faultCodes: items })
                  }
                />
                <ArraySection
                  titleKey="symptoms"
                  items={technicalCase.symptoms}
                  fields={symptomFields}
                  emptyItem={emptySymptom}
                  onChange={(items) =>
                    replaceCase({ ...technicalCase, symptoms: items })
                  }
                />
                <ArraySection
                  titleKey="components"
                  items={technicalCase.components}
                  fields={componentFields}
                  emptyItem={emptyComponent}
                  onChange={(items) =>
                    replaceCase({ ...technicalCase, components: items })
                  }
                />
                <ArraySection
                  titleKey="causes"
                  items={technicalCase.causes}
                  fields={causeFields}
                  emptyItem={emptyCause}
                  warningsForItem={causeWarnings}
                  onChange={(items) =>
                    replaceCase({ ...technicalCase, causes: items })
                  }
                />
                <ProceduresSection
                  procedures={technicalCase.procedures}
                  hasVariantScope={hasVariantScope}
                  onChange={(items) =>
                    replaceCase({ ...technicalCase, procedures: items })
                  }
                />
                <ArraySection
                  titleKey="measurements"
                  items={technicalCase.measurements}
                  fields={measurementFields}
                  emptyItem={emptyMeasurement}
                  warningsForItem={(item) =>
                    measurementWarnings(item, hasVariantScope)
                  }
                  onChange={(items) =>
                    replaceCase({ ...technicalCase, measurements: items })
                  }
                />
                <ArraySection
                  titleKey="solutions"
                  items={technicalCase.solutions}
                  fields={solutionFields}
                  emptyItem={emptySolution}
                  onChange={(items) =>
                    replaceCase({ ...technicalCase, solutions: items })
                  }
                />
                <ArraySection
                  titleKey="notes"
                  items={technicalCase.notes}
                  fields={noteFields}
                  emptyItem={emptyNote}
                  onChange={(items) =>
                    replaceCase({ ...technicalCase, notes: items })
                  }
                />
                <ArraySection
                  titleKey="parts"
                  items={technicalCase.parts}
                  fields={partFields}
                  emptyItem={emptyPart}
                  onChange={(items) =>
                    replaceCase({ ...technicalCase, parts: items })
                  }
                />
              </div>
            </article>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() =>
          mutate((next) => {
            next.cases.push(emptyCase());
          })
        }
        className="mt-6 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50"
      >
        {t("addCase")}
      </button>
      <footer className="sticky bottom-0 mt-8 flex flex-col gap-3 rounded-2xl border border-slate-300 bg-white/95 p-4 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <div>
          {message ? (
            <p
              role={message.tone === "error" ? "alert" : "status"}
              className={`text-sm font-medium ${message.tone === "error" ? "text-red-700" : "text-emerald-700"}`}
            >
              {message.text}
            </p>
          ) : (
            <p className="text-sm text-slate-600">{t("saveBeforeLeaving")}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={saveDraft}
            disabled={isSaving}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {isSaving ? t("saving") : t("saveDraft")}
          </button>
          <button
            type="button"
            disabled
            title={t("validateImportTitle")}
            className="cursor-not-allowed rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white opacity-45"
          >
            {t("validateImport")}
          </button>
        </div>
      </footer>
    </main>
  );
}
