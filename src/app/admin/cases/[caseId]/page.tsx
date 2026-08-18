import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { technicalCaseDetailQuery } from "@/lib/knowledge/case-browser";
import { prisma } from "@/lib/server/prisma";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Metadata");
  return { title: t("caseTitle") };
}

type SourceDocument = {
  id: string;
  originalFilename: string;
  bulletinReference: string | null;
};

function Section({
  title,
  empty,
  children,
}: {
  title: string;
  empty?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
      {empty ? (
        <p className="mt-3 text-sm text-slate-500">{children}</p>
      ) : (
        children
      )}
    </section>
  );
}

function Fields({
  fields,
}: {
  fields: Array<{ label: string; value: ReactNode }>;
}) {
  const visible = fields.filter(
    ({ value }) => value !== null && value !== undefined && value !== "",
  );

  return (
    <dl className="grid gap-x-5 gap-y-3 text-sm sm:grid-cols-2">
      {visible.map(({ label, value }, index) => (
        <div key={`${label}-${index}`}>
          <dt className="font-medium text-slate-500">{label}</dt>
          <dd className="mt-0.5 whitespace-pre-wrap text-slate-800">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function SourceReference({
  document,
  page,
  sourceLabel,
}: {
  document: SourceDocument | null;
  page: number | null;
  sourceLabel: string;
}) {
  if (!document && !page) return null;
  const name =
    document?.bulletinReference ?? document?.originalFilename ?? sourceLabel;

  return (
    <p className="mt-3 text-xs text-slate-500">
      {document ? (
        <a
          href={`/api/admin/documents/${document.id}/pdf`}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-blue-700 hover:underline"
        >
          {name}
        </a>
      ) : (
        name
      )}
      {page ? ` — ${sourceLabel} ${page}` : null}
    </p>
  );
}

function ItemCard({ children }: { children: ReactNode }) {
  return (
    <article className="rounded-xl border border-slate-200 p-4">
      {children}
    </article>
  );
}

function componentName(
  component: { name: string; manufacturerIdentifier: string | null } | null,
) {
  if (!component) return null;
  return [component.name, component.manufacturerIdentifier]
    .filter(Boolean)
    .join(" · ");
}

function applicabilityName(
  applicability: {
    brand: string | null;
    model: string | null;
    engineCode: string | null;
    engineFamily: string | null;
  } | null,
) {
  if (!applicability) return null;
  return [
    [applicability.brand, applicability.model].filter(Boolean).join(" "),
    applicability.engineCode,
    applicability.engineFamily,
  ]
    .filter(Boolean)
    .join(" · ");
}

export default async function TechnicalCasePage(
  props: PageProps<"/admin/cases/[caseId]">,
) {
  const { caseId } = await props.params;
  if (!caseId || caseId.length > 64) notFound();

  const technicalCase = await prisma.technicalCase.findUnique(
    technicalCaseDetailQuery(caseId),
  );
  if (!technicalCase) notFound();

  const [t, enumT, browserT] = await Promise.all([
    getTranslations("CaseDetail"),
    getTranslations("Review.enum"),
    getTranslations("CaseBrowser"),
  ]);
  const empty = t("empty");
  const sourceLabel = t("sourcePage");

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-10">
      <Link
        href="/admin/cases"
        className="text-sm font-semibold text-blue-700 hover:underline"
      >
        ← {t("back")}
      </Link>

      <header className="mt-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
            {browserT(`status.${technicalCase.validationStatus}`)}
          </span>
          {technicalCase.reviewedByHuman ? (
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800">
              {t("manuallyReviewed")}
            </span>
          ) : null}
          {technicalCase.primarySystem ? (
            <span className="text-sm text-slate-500">
              {technicalCase.primarySystem}
            </span>
          ) : null}
        </div>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <h1 className="text-3xl font-semibold text-slate-950">
            {technicalCase.title}
          </h1>
          <Link
            href={`/admin/cases/${encodeURIComponent(technicalCase.id)}/edit`}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            {t("edit")}
          </Link>
        </div>
        {technicalCase.sources.length > 0 ? (
          <div className="mt-5 flex flex-wrap gap-2">
            {technicalCase.sources.map(({ sourceDocument, isPrimary }) => (
              <a
                key={sourceDocument.id}
                href={`/api/admin/documents/${sourceDocument.id}/pdf`}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-slate-50"
              >
                {t("openSource", {
                  source:
                    sourceDocument.bulletinReference ??
                    sourceDocument.originalFilename,
                })}
                {isPrimary ? ` · ${t("primarySource")}` : ""}
              </a>
            ))}
          </div>
        ) : null}
      </header>

      <div className="mt-6 space-y-6">
        <Section title={t("general")}>
          <div className="mt-4">
            <Fields
              fields={[
                { label: t("fields.title"), value: technicalCase.title },
                {
                  label: t("fields.primarySystem"),
                  value: technicalCase.primarySystem,
                },
                {
                  label: t("fields.validationStatus"),
                  value: browserT(`status.${technicalCase.validationStatus}`),
                },
                { label: t("fields.summary"), value: technicalCase.summary },
                {
                  label: t("fields.problemDescription"),
                  value: technicalCase.problemDescription,
                },
                {
                  label: t("fields.reviewNotes"),
                  value: technicalCase.reviewNotes,
                },
              ]}
            />
          </div>
        </Section>

        <Section
          title={t("applicability")}
          empty={technicalCase.applicability.length === 0}
        >
          {technicalCase.applicability.length === 0 ? (
            empty
          ) : (
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {technicalCase.applicability.map((item) => (
                <ItemCard key={item.id}>
                  <Fields
                    fields={[
                      { label: t("fields.brand"), value: item.brand },
                      { label: t("fields.model"), value: item.model },
                      {
                        label: t("fields.platform"),
                        value: item.generationOrPlatform,
                      },
                      {
                        label: t("fields.years"),
                        value:
                          item.yearFrom || item.yearTo
                            ? `${item.yearFrom ?? "—"}–${item.yearTo ?? "—"}`
                            : null,
                      },
                      {
                        label: t("fields.engineLabel"),
                        value: item.engineLabel,
                      },
                      {
                        label: t("fields.engineFamily"),
                        value: item.engineFamily,
                      },
                      { label: t("fields.engineCode"), value: item.engineCode },
                      {
                        label: t("fields.enginePattern"),
                        value: item.engineCodePattern,
                      },
                      {
                        label: t("fields.engineMatch"),
                        value: item.engineMatchType
                          ? enumT(item.engineMatchType)
                          : null,
                      },
                      { label: t("fields.fuelType"), value: item.fuelType },
                      {
                        label: t("fields.transmission"),
                        value: item.transmission,
                      },
                      {
                        label: t("fields.variantNotes"),
                        value: item.variantNotes,
                      },
                    ]}
                  />
                  <SourceReference
                    document={item.sourceDocument}
                    page={item.sourcePage}
                    sourceLabel={sourceLabel}
                  />
                </ItemCard>
              ))}
            </div>
          )}
        </Section>

        <Section
          title={t("faultCodes")}
          empty={technicalCase.faultCodes.length === 0}
        >
          {technicalCase.faultCodes.length === 0 ? (
            empty
          ) : (
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {technicalCase.faultCodes.map((item) => (
                <ItemCard key={item.id}>
                  <Fields
                    fields={[
                      { label: t("fields.rawCode"), value: item.rawCode },
                      {
                        label: t("fields.normalizedCode"),
                        value: item.normalizedCode,
                      },
                      {
                        label: t("fields.manufacturerCode"),
                        value: item.manufacturerCode,
                      },
                      {
                        label: t("fields.description"),
                        value: item.description,
                      },
                      {
                        label: t("fields.role"),
                        value: item.role ? enumT(item.role) : null,
                      },
                      {
                        label: t("fields.controlModule"),
                        value: item.controlModule,
                      },
                    ]}
                  />
                  <SourceReference
                    document={item.sourceDocument}
                    page={item.sourcePage}
                    sourceLabel={sourceLabel}
                  />
                </ItemCard>
              ))}
            </div>
          )}
        </Section>

        <Section
          title={t("symptoms")}
          empty={technicalCase.symptoms.length === 0}
        >
          {technicalCase.symptoms.length === 0 ? (
            empty
          ) : (
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {technicalCase.symptoms.map((item) => (
                <ItemCard key={item.id}>
                  <Fields
                    fields={[
                      { label: t("fields.label"), value: item.label },
                      { label: t("fields.details"), value: item.details },
                      {
                        label: t("fields.operatingCondition"),
                        value: item.operatingCondition,
                      },
                    ]}
                  />
                  <SourceReference
                    document={item.sourceDocument}
                    page={item.sourcePage}
                    sourceLabel={sourceLabel}
                  />
                </ItemCard>
              ))}
            </div>
          )}
        </Section>

        <Section
          title={t("components")}
          empty={technicalCase.components.length === 0}
        >
          {technicalCase.components.length === 0 ? (
            empty
          ) : (
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {technicalCase.components.map((item) => (
                <ItemCard key={item.id}>
                  <Fields
                    fields={[
                      { label: t("fields.name"), value: item.name },
                      {
                        label: t("fields.identifier"),
                        value: item.manufacturerIdentifier,
                      },
                      { label: t("fields.system"), value: item.system },
                      { label: t("fields.componentRole"), value: item.role },
                    ]}
                  />
                  <SourceReference
                    document={item.sourceDocument}
                    page={item.sourcePage}
                    sourceLabel={sourceLabel}
                  />
                </ItemCard>
              ))}
            </div>
          )}
        </Section>

        <Section title={t("causes")} empty={technicalCase.causes.length === 0}>
          {technicalCase.causes.length === 0 ? (
            empty
          ) : (
            <div className="mt-4 space-y-3">
              {technicalCase.causes.map((item) => (
                <ItemCard key={item.id}>
                  <Fields
                    fields={[
                      {
                        label: t("fields.description"),
                        value: item.description,
                      },
                      {
                        label: t("fields.certainty"),
                        value: enumT(item.certainty),
                      },
                      { label: t("fields.category"), value: item.category },
                      { label: t("fields.priority"), value: item.priority },
                      {
                        label: t("fields.condition"),
                        value: item.conditionText,
                      },
                      {
                        label: t("fields.relatedComponent"),
                        value: componentName(item.component),
                      },
                    ]}
                  />
                  <SourceReference
                    document={item.sourceDocument}
                    page={item.sourcePage}
                    sourceLabel={sourceLabel}
                  />
                </ItemCard>
              ))}
            </div>
          )}
        </Section>

        <Section
          title={t("solutions")}
          empty={technicalCase.solutions.length === 0}
        >
          {technicalCase.solutions.length === 0 ? (
            empty
          ) : (
            <div className="mt-4 space-y-3">
              {technicalCase.solutions.map((item) => (
                <ItemCard key={item.id}>
                  <Fields
                    fields={[
                      { label: t("fields.type"), value: enumT(item.type) },
                      {
                        label: t("fields.description"),
                        value: item.description,
                      },
                      {
                        label: t("fields.condition"),
                        value: item.conditionText,
                      },
                      { label: t("fields.priority"), value: item.priority },
                      {
                        label: t("fields.relatedComponent"),
                        value: componentName(item.component),
                      },
                    ]}
                  />
                  <SourceReference
                    document={item.sourceDocument}
                    page={item.sourcePage}
                    sourceLabel={sourceLabel}
                  />
                </ItemCard>
              ))}
            </div>
          )}
        </Section>

        <Section
          title={t("procedures")}
          empty={technicalCase.procedures.length === 0}
        >
          {technicalCase.procedures.length === 0 ? (
            empty
          ) : (
            <div className="mt-4 space-y-5">
              {technicalCase.procedures.map((procedure) => (
                <article
                  key={procedure.id}
                  className="rounded-xl border border-slate-200 p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800">
                      {enumT(procedure.type)}
                    </span>
                    <h3 className="font-semibold text-slate-950">
                      {procedure.position}. {procedure.title}
                    </h3>
                  </div>
                  {procedure.description ? (
                    <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                      {procedure.description}
                    </p>
                  ) : null}
                  {procedure.steps.length === 0 ? (
                    <p className="mt-3 text-sm text-slate-500">{empty}</p>
                  ) : (
                    <ol className="mt-4 space-y-3">
                      {procedure.steps.map((step) => (
                        <li
                          key={step.id}
                          className="rounded-lg bg-slate-50 p-4"
                        >
                          <p className="font-medium text-slate-950">
                            {t("step", { position: step.position })}:{" "}
                            {step.instruction}
                          </p>
                          <div className="mt-3">
                            <Fields
                              fields={[
                                {
                                  label: t("fields.precondition"),
                                  value: step.precondition,
                                },
                                {
                                  label: t("fields.expectedResult"),
                                  value: step.expectedResult,
                                },
                                {
                                  label: t("fields.ifPass"),
                                  value: step.ifPass,
                                },
                                {
                                  label: t("fields.ifFail"),
                                  value: step.ifFail,
                                },
                                {
                                  label: t("fields.tools"),
                                  value: step.toolsText,
                                },
                                {
                                  label: t("fields.relatedComponent"),
                                  value: componentName(step.component),
                                },
                                {
                                  label: t("fields.relatedApplicability"),
                                  value: applicabilityName(step.applicability),
                                },
                              ]}
                            />
                          </div>
                          <SourceReference
                            document={step.sourceDocument}
                            page={step.sourcePage}
                            sourceLabel={sourceLabel}
                          />
                        </li>
                      ))}
                    </ol>
                  )}
                </article>
              ))}
            </div>
          )}
        </Section>

        <Section
          title={t("measurements")}
          empty={technicalCase.measurementSpecs.length === 0}
        >
          {technicalCase.measurementSpecs.length === 0 ? (
            empty
          ) : (
            <div className="mt-4 space-y-3">
              {technicalCase.measurementSpecs.map((item) => (
                <article
                  key={item.id}
                  className={`rounded-xl border p-4 ${item.isExample ? "border-amber-300 bg-amber-50" : "border-slate-200"}`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-slate-950">
                      {item.parameter}
                    </h3>
                    {item.isExample ? (
                      <span className="rounded-full bg-amber-200 px-2.5 py-1 text-xs font-semibold text-amber-900">
                        {t("example")}
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                        {t("specification")}
                      </span>
                    )}
                    {item.isApproximate ? (
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                        {t("approximate")}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-3">
                    <Fields
                      fields={[
                        {
                          label: t("fields.measurementType"),
                          value: item.measurementType,
                        },
                        {
                          label: t("fields.target"),
                          value: item.targetValue?.toString(),
                        },
                        {
                          label: t("fields.minimum"),
                          value: item.minValue?.toString(),
                        },
                        {
                          label: t("fields.maximum"),
                          value: item.maxValue?.toString(),
                        },
                        {
                          label: t("fields.tolerancePlus"),
                          value: item.tolerancePlus?.toString(),
                        },
                        {
                          label: t("fields.toleranceMinus"),
                          value: item.toleranceMinus?.toString(),
                        },
                        { label: t("fields.unit"), value: item.unit },
                        {
                          label: t("fields.expectedText"),
                          value: item.expectedText,
                        },
                        {
                          label: t("fields.condition"),
                          value: item.conditionText,
                        },
                        {
                          label: t("fields.duration"),
                          value: item.durationSeconds,
                        },
                        {
                          label: t("fields.repeatCount"),
                          value: item.repeatCount,
                        },
                        {
                          label: t("fields.relatedComponent"),
                          value: componentName(item.component),
                        },
                        {
                          label: t("fields.relatedApplicability"),
                          value: applicabilityName(item.applicability),
                        },
                        {
                          label: t("fields.relatedStep"),
                          value: item.procedureStep
                            ? `${item.procedureStep.procedure.position}. ${item.procedureStep.procedure.title} · ${item.procedureStep.position}`
                            : null,
                        },
                      ]}
                    />
                  </div>
                  <SourceReference
                    document={item.sourceDocument}
                    page={item.sourcePage}
                    sourceLabel={sourceLabel}
                  />
                </article>
              ))}
            </div>
          )}
        </Section>

        <Section title={t("notes")} empty={technicalCase.notes.length === 0}>
          {technicalCase.notes.length === 0 ? (
            empty
          ) : (
            <div className="mt-4 space-y-3">
              {technicalCase.notes.map((item) => (
                <ItemCard key={item.id}>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                    {enumT(item.type)}
                  </span>
                  <p className="mt-3 whitespace-pre-wrap text-sm text-slate-800">
                    {item.text}
                  </p>
                  {item.externalReference ? (
                    <p className="mt-2 text-sm text-slate-600">
                      {t("fields.externalReference")}: {item.externalReference}
                    </p>
                  ) : null}
                  <SourceReference
                    document={item.sourceDocument}
                    page={item.sourcePage}
                    sourceLabel={sourceLabel}
                  />
                </ItemCard>
              ))}
            </div>
          )}
        </Section>

        <Section title={t("parts")} empty={technicalCase.parts.length === 0}>
          {technicalCase.parts.length === 0 ? (
            empty
          ) : (
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {technicalCase.parts.map((item) => (
                <ItemCard key={item.id}>
                  <Fields
                    fields={[
                      { label: t("fields.partNumber"), value: item.partNumber },
                      {
                        label: t("fields.description"),
                        value: item.description,
                      },
                      { label: t("fields.partRole"), value: item.role },
                      {
                        label: t("fields.vinRequired"),
                        value: item.vinVerificationRequired
                          ? t("yes")
                          : t("no"),
                      },
                      {
                        label: t("fields.relatedComponent"),
                        value: componentName(item.component),
                      },
                      {
                        label: t("fields.relatedApplicability"),
                        value: applicabilityName(item.applicability),
                      },
                    ]}
                  />
                  <SourceReference
                    document={item.sourceDocument}
                    page={item.sourcePage}
                    sourceLabel={sourceLabel}
                  />
                </ItemCard>
              ))}
            </div>
          )}
        </Section>
      </div>
    </main>
  );
}
