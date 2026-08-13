import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { prisma } from "@/lib/server/prisma";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Metadata");
  return { title: t("caseTitle") };
}

export default async function TechnicalCasePage(
  props: PageProps<"/admin/cases/[caseId]">,
) {
  const { caseId } = await props.params;
  if (!caseId || caseId.length > 64) notFound();

  const technicalCase = await prisma.technicalCase.findUnique({
    where: { id: caseId },
    include: {
      sources: {
        include: {
          sourceDocument: { select: { id: true, originalFilename: true } },
        },
      },
      applicability: true,
      faultCodes: true,
      symptoms: true,
      components: true,
      causes: true,
      solutions: true,
      procedures: {
        orderBy: { position: "asc" },
        include: { steps: { orderBy: { position: "asc" } } },
      },
      measurementSpecs: true,
      notes: true,
      parts: true,
    },
  });
  if (!technicalCase) notFound();

  const t = await getTranslations("CaseDetail");
  const sections = [
    [t("faultCodes"), technicalCase.faultCodes.map((item) => item.rawCode)],
    [
      t("applicability"),
      technicalCase.applicability.map((item) =>
        [item.brand, item.model, item.engineCode].filter(Boolean).join(" · "),
      ),
    ],
    [t("symptoms"), technicalCase.symptoms.map((item) => item.label)],
    [t("components"), technicalCase.components.map((item) => item.name)],
    [t("causes"), technicalCase.causes.map((item) => item.description)],
    [t("solutions"), technicalCase.solutions.map((item) => item.description)],
    [t("notes"), technicalCase.notes.map((item) => item.text)],
    [
      t("parts"),
      technicalCase.parts.map((item) =>
        [item.partNumber, item.description].filter(Boolean).join(" · "),
      ),
    ],
  ] as const;

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-10">
      <Link
        href="/admin/documents"
        className="text-sm font-semibold text-blue-700 hover:underline"
      >
        {t("back")}
      </Link>
      <header className="mt-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
          {t("validated")}
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-950">
          {technicalCase.title}
        </h1>
        {technicalCase.summary ? (
          <p className="mt-3 text-slate-700">{technicalCase.summary}</p>
        ) : null}
        {technicalCase.problemDescription ? (
          <p className="mt-3 whitespace-pre-wrap text-slate-700">
            {technicalCase.problemDescription}
          </p>
        ) : null}
        <p className="mt-4 text-sm text-slate-600">
          {t("source")}:{" "}
          {technicalCase.sources[0]?.sourceDocument.originalFilename}
        </p>
      </header>

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        {sections.map(([title, items]) =>
          items.length > 0 ? (
            <section
              key={title}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <h2 className="font-semibold text-slate-950">{title}</h2>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
                {items.map((item, index) => (
                  <li key={`${index}-${item}`}>{item}</li>
                ))}
              </ul>
            </section>
          ) : null,
        )}
      </div>

      {technicalCase.procedures.length > 0 ? (
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-950">{t("procedures")}</h2>
          <div className="mt-3 space-y-4">
            {technicalCase.procedures.map((procedure) => (
              <div key={procedure.id}>
                <h3 className="font-medium text-slate-900">
                  {procedure.position}. {procedure.title}
                </h3>
                <ol className="mt-2 list-decimal space-y-1 pl-6 text-sm text-slate-700">
                  {procedure.steps.map((step) => (
                    <li key={step.id}>{step.instruction}</li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {technicalCase.measurementSpecs.length > 0 ? (
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-950">{t("measurements")}</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            {technicalCase.measurementSpecs.map((measurement) => (
              <li key={measurement.id}>
                {measurement.parameter}:{" "}
                {measurement.targetValue?.toString() ?? "—"}{" "}
                {measurement.unit ?? ""}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
