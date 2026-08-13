"use client";

import Link from "next/link";
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
  label: string;
  kind?: "text" | "textarea" | "number" | "checkbox" | "select";
  options?: readonly string[];
  required?: boolean;
};
type Warning = { text: string; tone?: "danger" | "warning" };

const sourcePageField: FieldDefinition = {
  key: "sourcePage",
  label: "Source page",
  kind: "number",
};

const applicabilityFields: FieldDefinition[] = [
  { key: "brand", label: "Brand" },
  { key: "model", label: "Model" },
  { key: "generationOrPlatform", label: "Generation / platform" },
  { key: "yearFrom", label: "Year from", kind: "number" },
  { key: "yearTo", label: "Year to", kind: "number" },
  { key: "engineLabel", label: "Engine label" },
  { key: "engineFamily", label: "Engine family" },
  { key: "engineCode", label: "Engine code" },
  { key: "engineCodePattern", label: "Engine code pattern" },
  {
    key: "engineMatchType",
    label: "Engine match",
    kind: "select",
    options: ["EXACT", "PREFIX", "PATTERN", "FAMILY", "ALL"],
  },
  { key: "fuelType", label: "Fuel type" },
  { key: "transmission", label: "Transmission" },
  { key: "variantNotes", label: "Variant conditions", kind: "textarea" },
  sourcePageField,
];

const faultCodeFields: FieldDefinition[] = [
  { key: "rawCode", label: "Code as written", required: true },
  { key: "normalizedCode", label: "Normalized code" },
  { key: "manufacturerCode", label: "Manufacturer code" },
  { key: "description", label: "Description", kind: "textarea" },
  {
    key: "role",
    label: "DTC role",
    kind: "select",
    options: ["PRIMARY", "RELATED", "CONSEQUENTIAL"],
  },
  { key: "controlModule", label: "Control module" },
  sourcePageField,
];

const symptomFields: FieldDefinition[] = [
  { key: "label", label: "Symptom", required: true },
  { key: "normalizedLabel", label: "Normalized symptom" },
  { key: "details", label: "Details", kind: "textarea" },
  { key: "operatingCondition", label: "Operating condition", kind: "textarea" },
  sourcePageField,
];

const componentFields: FieldDefinition[] = [
  { key: "name", label: "Component", required: true },
  { key: "normalizedName", label: "Normalized name" },
  { key: "manufacturerIdentifier", label: "Identifier (N75, G581, etc.)" },
  { key: "system", label: "System" },
  { key: "role", label: "Role" },
  sourcePageField,
];

const causeFields: FieldDefinition[] = [
  { key: "description", label: "Cause", kind: "textarea", required: true },
  { key: "componentReference", label: "Component reference" },
  { key: "category", label: "Category" },
  {
    key: "certainty",
    label: "Cause certainty",
    kind: "select",
    options: ["POSSIBLE", "LIKELY", "CONFIRMED"],
    required: true,
  },
  { key: "priority", label: "Priority", kind: "number" },
  {
    key: "conditionText",
    label: "Applicability / condition",
    kind: "textarea",
  },
  sourcePageField,
];

const solutionFields: FieldDefinition[] = [
  {
    key: "type",
    label: "Action type",
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
  { key: "description", label: "Solution", kind: "textarea", required: true },
  { key: "componentReference", label: "Component reference" },
  {
    key: "conditionText",
    label: "Applicability / condition",
    kind: "textarea",
  },
  { key: "priority", label: "Priority", kind: "number" },
  sourcePageField,
];

const procedureFields: FieldDefinition[] = [
  {
    key: "type",
    label: "Procedure type",
    kind: "select",
    options: ["DIAGNOSTIC", "REPAIR", "CALIBRATION", "VERIFICATION"],
    required: true,
  },
  { key: "title", label: "Procedure title", required: true },
  { key: "description", label: "Description", kind: "textarea" },
  { key: "position", label: "Procedure order", kind: "number", required: true },
];

const stepFields: FieldDefinition[] = [
  { key: "position", label: "Step order", kind: "number", required: true },
  {
    key: "instruction",
    label: "Instruction",
    kind: "textarea",
    required: true,
  },
  {
    key: "precondition",
    label: "Precondition / test condition",
    kind: "textarea",
  },
  { key: "expectedResult", label: "Expected result", kind: "textarea" },
  { key: "ifPass", label: "If test passes", kind: "textarea" },
  { key: "ifFail", label: "If test fails", kind: "textarea" },
  { key: "toolsText", label: "Tools required", kind: "textarea" },
  { key: "componentReference", label: "Component reference" },
  { key: "applicabilityReference", label: "Applicability / variant reference" },
  sourcePageField,
];

const measurementFields: FieldDefinition[] = [
  { key: "parameter", label: "Measured parameter", required: true },
  { key: "measurementType", label: "Measurement type" },
  { key: "targetValue", label: "Target value", kind: "number" },
  { key: "minValue", label: "Minimum", kind: "number" },
  { key: "maxValue", label: "Maximum", kind: "number" },
  { key: "tolerancePlus", label: "Tolerance +", kind: "number" },
  { key: "toleranceMinus", label: "Tolerance −", kind: "number" },
  { key: "unit", label: "Unit" },
  {
    key: "expectedText",
    label: "Expected value / result text",
    kind: "textarea",
  },
  {
    key: "conditionText",
    label: "Test and variant conditions",
    kind: "textarea",
  },
  { key: "durationSeconds", label: "Duration (seconds)", kind: "number" },
  { key: "repeatCount", label: "Repeat count", kind: "number" },
  { key: "isApproximate", label: "Approximate value", kind: "checkbox" },
  { key: "isExample", label: "Example, not specification", kind: "checkbox" },
  sourcePageField,
];

const noteFields: FieldDefinition[] = [
  {
    key: "type",
    label: "Note type",
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
  { key: "text", label: "Note / warning", kind: "textarea", required: true },
  { key: "externalReference", label: "External reference" },
  sourcePageField,
];

const partFields: FieldDefinition[] = [
  { key: "partNumber", label: "Part number", required: true },
  { key: "description", label: "Description", kind: "textarea" },
  { key: "role", label: "Role" },
  { key: "vinVerificationRequired", label: "Verify by VIN", kind: "checkbox" },
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
    title: "New technical case",
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
  const record = item as Record<string, EditableValue>;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {fields.map((field) => {
        const value = record[field.key];
        const sharedClass =
          "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100";
        const update = (nextValue: string | boolean) =>
          onChange({ ...item, [field.key]: parseValue(field, nextValue) });
        return (
          <label
            key={field.key}
            className={field.kind === "textarea" ? "md:col-span-2" : ""}
          >
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              {field.label}
              {field.required ? " *" : ""}
            </span>
            {field.kind === "checkbox" ? (
              <span className="mt-2 flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={Boolean(value)}
                  onChange={(event) => update(event.target.checked)}
                />{" "}
                Yes
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
                <option value="">Not specified</option>
                {field.options?.map((option) => (
                  <option key={option} value={option}>
                    {option}
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
  if (warnings.length === 0) return null;
  return (
    <div className="mb-4 space-y-2">
      {warnings.map((warning, index) => (
        <p
          key={`${warning.text}-${index}`}
          role="alert"
          className={`rounded-lg border px-3 py-2 text-sm font-medium ${warning.tone === "danger" ? "border-red-300 bg-red-50 text-red-800" : "border-amber-300 bg-amber-50 text-amber-900"}`}
        >
          {warning.text}
        </p>
      ))}
    </div>
  );
}

function ArraySection<T extends object>({
  title,
  items,
  fields,
  emptyItem,
  onChange,
  warningsForItem,
}: {
  title: string;
  items: T[];
  fields: FieldDefinition[];
  emptyItem: T;
  onChange: (items: T[]) => void;
  warningsForItem?: (item: T) => Warning[];
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50 p-5">
      <div className="flex items-center justify-between gap-4">
        <h3 className="font-semibold text-slate-950">{title}</h3>
        <button
          type="button"
          onClick={() => onChange([...items, structuredClone(emptyItem)])}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-100"
        >
          Add item
        </button>
      </div>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">No items extracted.</p>
      ) : (
        <div className="mt-4 space-y-4">
          {items.map((item, index) => (
            <article
              key={index}
              className="rounded-xl border border-slate-200 bg-white p-4"
            >
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700">
                  Item {index + 1}
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
                  Delete
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
        <h3 className="font-semibold text-slate-950">
          Diagnostic / repair procedures and steps
        </h3>
        <button
          type="button"
          onClick={() =>
            onChange([
              ...procedures,
              {
                type: "DIAGNOSTIC",
                title: "New procedure",
                description: null,
                position: procedures.length + 1,
                steps: [],
              },
            ])
          }
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-100"
        >
          Add procedure
        </button>
      </div>
      {procedures.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">No procedures extracted.</p>
      ) : (
        <div className="mt-4 space-y-5">
          {procedures.map((procedure, procedureIndex) => (
            <article
              key={procedureIndex}
              className="rounded-xl border border-slate-200 bg-white p-4"
            >
              <div className="mb-4 flex items-center justify-between">
                <p className="font-semibold text-slate-800">
                  Procedure {procedureIndex + 1}
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
                  Delete procedure
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
                    Procedure steps
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
                    Add step
                  </button>
                </div>
                <div className="mt-4 space-y-4">
                  {procedure.steps.map((step, stepIndex) => {
                    const warnings: Warning[] =
                      hasVariantScope && !step.applicabilityReference
                        ? [
                            {
                              text: "Variant-sensitive case: this step has no applicability reference.",
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
                            Step {stepIndex + 1}
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
                              Move up
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
                              Move down
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
                              Delete
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
          text: "Variant-specific information has no vehicle or engine scope.",
          tone: "danger",
        },
      ]
    : [];
}
function faultWarnings(item: FaultCode): Warning[] {
  return item.role === "CONSEQUENTIAL"
    ? [{ text: "Consequential DTC: do not treat this as the primary fault." }]
    : [];
}
function causeWarnings(item: Cause): Warning[] {
  return item.certainty === "CONFIRMED"
    ? [
        {
          text: "Confirmed cause: verify the source wording and applicability carefully.",
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
    warnings.push({ text: "Numeric measurement has no unit.", tone: "danger" });
  if (hasNumericValue && !item.parameter.trim())
    warnings.push({
      text: "Numeric measurement has no parameter.",
      tone: "danger",
    });
  if (
    item.minValue !== null &&
    item.maxValue !== null &&
    item.minValue > item.maxValue
  )
    warnings.push({
      text: "Minimum value is greater than maximum value.",
      tone: "danger",
    });
  if (item.isExample)
    warnings.push({
      text: "Example measurement: do not import as a technical specification without confirmation.",
    });
  if (hasVariantScope && !item.conditionText?.trim())
    warnings.push({
      text: "Variant-sensitive case: measurement has no test or applicability condition.",
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
      if (!response.ok)
        throw new Error(result.error ?? "The review could not be saved.");
      if (result.draft) setDraft(result.draft);
      const savedTime = result.savedAt
        ? new Date(result.savedAt).toLocaleTimeString()
        : "now";
      setMessage({ tone: "success", text: `Draft saved at ${savedTime}.` });
    } catch (error) {
      setMessage({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : "The review could not be saved.",
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
            Draft review
          </p>
          <h1 className="mt-2 break-words text-2xl font-semibold text-slate-950">
            {originalFilename}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Latest successful extraction
            {completedAt ? ` · ${new Date(completedAt).toLocaleString()}` : ""}.
            Changes remain draft data.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin/documents"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
          >
            Back to documents
          </Link>
          <a
            href={`/api/admin/documents/${encodeURIComponent(documentId)}/pdf`}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-100"
          >
            Open source PDF
          </a>
        </div>
      </header>

      <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-950">Document</h2>
        <div className="mt-5">
          <ItemFields
            item={draft.document}
            fields={[
              { key: "detectedTitle", label: "Detected title" },
              { key: "bulletinReference", label: "Bulletin reference" },
              { key: "publisher", label: "Publisher" },
              { key: "language", label: "Language" },
              {
                key: "claimedPageCount",
                label: "Claimed page count",
                kind: "number",
              },
              {
                key: "completenessNotes",
                label: "Completeness notes",
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
                    text: "Variant-specific information has no applicability record.",
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
                    Technical case {caseIndex + 1}
                  </p>
                  <h2 className="mt-1 text-xl font-semibold text-slate-950">
                    {technicalCase.title || "Untitled case"}
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
                  Delete case
                </button>
              </div>
              <WarningList warnings={caseWarnings} />
              <div className="space-y-5">
                <section className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                  <h3 className="mb-4 font-semibold">General</h3>
                  <ItemFields
                    item={technicalCase}
                    fields={[
                      { key: "title", label: "Case title", required: true },
                      { key: "primarySystem", label: "Primary system" },
                      { key: "summary", label: "Summary", kind: "textarea" },
                      {
                        key: "problemDescription",
                        label: "Problem description",
                        kind: "textarea",
                      },
                    ]}
                    onChange={replaceCase}
                  />
                </section>
                <ArraySection
                  title="Applicability"
                  items={technicalCase.applicability}
                  fields={applicabilityFields}
                  emptyItem={emptyApplicability}
                  warningsForItem={applicabilityWarnings}
                  onChange={(items) =>
                    replaceCase({ ...technicalCase, applicability: items })
                  }
                />
                <ArraySection
                  title="Fault codes"
                  items={technicalCase.faultCodes}
                  fields={faultCodeFields}
                  emptyItem={emptyFaultCode}
                  warningsForItem={faultWarnings}
                  onChange={(items) =>
                    replaceCase({ ...technicalCase, faultCodes: items })
                  }
                />
                <ArraySection
                  title="Symptoms"
                  items={technicalCase.symptoms}
                  fields={symptomFields}
                  emptyItem={emptySymptom}
                  onChange={(items) =>
                    replaceCase({ ...technicalCase, symptoms: items })
                  }
                />
                <ArraySection
                  title="Components"
                  items={technicalCase.components}
                  fields={componentFields}
                  emptyItem={emptyComponent}
                  onChange={(items) =>
                    replaceCase({ ...technicalCase, components: items })
                  }
                />
                <ArraySection
                  title="Causes"
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
                  title="Measurements"
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
                  title="Solutions"
                  items={technicalCase.solutions}
                  fields={solutionFields}
                  emptyItem={emptySolution}
                  onChange={(items) =>
                    replaceCase({ ...technicalCase, solutions: items })
                  }
                />
                <ArraySection
                  title="Notes / warnings"
                  items={technicalCase.notes}
                  fields={noteFields}
                  emptyItem={emptyNote}
                  onChange={(items) =>
                    replaceCase({ ...technicalCase, notes: items })
                  }
                />
                <ArraySection
                  title="Parts"
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
        Add technical case
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
            <p className="text-sm text-slate-600">
              Save before leaving to keep review changes.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={saveDraft}
            disabled={isSaving}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {isSaving ? "Saving…" : "Save draft"}
          </button>
          <button
            type="button"
            disabled
            title="Domain import will be implemented in the next step."
            className="cursor-not-allowed rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white opacity-45"
          >
            Validate and import · Not implemented yet
          </button>
        </div>
      </footer>
    </main>
  );
}
