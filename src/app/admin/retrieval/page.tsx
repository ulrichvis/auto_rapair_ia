import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import type {
  KnowledgeSearchInput,
  KnowledgeSearchResult,
} from "@/lib/knowledge/knowledge-retrieval";
import { InvalidKnowledgeSearchError } from "@/lib/knowledge/knowledge-retrieval";
import { searchKnowledge } from "@/lib/server/knowledge/knowledge-retrieval";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Metadata");
  return { title: t("retrievalTitle") };
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function clean(value: string | undefined) {
  return value?.trim().slice(0, 100) || undefined;
}

function hasSearchValues(values: Record<string, string | undefined>) {
  return Object.values(values).some(Boolean);
}

function applicabilityLabel(
  item: KnowledgeSearchResult["matchingApplicability"][number],
) {
  const vehicle = [item.brand, item.model].filter(Boolean).join(" ");
  const engine = [item.engineCode, item.engineFamily]
    .filter(Boolean)
    .join(" / ");
  const years =
    item.yearFrom !== null || item.yearTo !== null
      ? `${item.yearFrom ?? "…"}–${item.yearTo ?? "…"}`
      : "";

  return [vehicle, engine, years].filter(Boolean).join(" · ");
}

function Values({ values, empty }: { values: string[]; empty: string }) {
  if (values.length === 0)
    return <span className="text-slate-400">{empty}</span>;

  return (
    <span className="flex flex-wrap gap-1.5">
      {values.map((value, index) => (
        <span
          key={`${value}-${index}`}
          className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
        >
          {value}
        </span>
      ))}
    </span>
  );
}

export default async function AdminRetrievalPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const values = {
    brand: clean(first(query.brand)),
    model: clean(first(query.model)),
    engineCode: clean(first(query.engineCode)),
    engineFamily: clean(first(query.engineFamily)),
    dtc: clean(first(query.dtc)),
    symptom: clean(first(query.symptom)),
    component: clean(first(query.component)),
    system: clean(first(query.system)),
    year: clean(first(query.year)),
  };
  const hasSearch = hasSearchValues(values);
  const [t, statusT] = await Promise.all([
    getTranslations("Retrieval"),
    getTranslations("CaseBrowser.status"),
  ]);
  let results: KnowledgeSearchResult[] = [];
  let error: string | null = null;

  if (hasSearch) {
    const parsedYear = values.year ? Number(values.year) : undefined;
    if (
      values.year &&
      (!Number.isInteger(parsedYear) || parsedYear! < 0 || parsedYear! > 9999)
    ) {
      error = t("invalidYear");
    } else {
      const input: KnowledgeSearchInput = {
        brand: values.brand,
        model: values.model,
        engineCode: values.engineCode,
        engineFamily: values.engineFamily,
        dtc: values.dtc,
        symptoms: values.symptom ? [values.symptom] : undefined,
        components: values.component ? [values.component] : undefined,
        system: values.system,
        year: parsedYear,
      };

      try {
        results = await searchKnowledge(input);
      } catch (searchError) {
        console.error("Knowledge retrieval failed", {
          message:
            searchError instanceof Error
              ? searchError.message
              : "Unknown retrieval error",
        });
        error =
          searchError instanceof InvalidKnowledgeSearchError
            ? t("invalidYear")
            : t("searchFailed");
      }
    }
  }

  const fields: Array<{
    key: keyof typeof values;
    type?: "number";
  }> = [
    { key: "brand" },
    { key: "model" },
    { key: "engineCode" },
    { key: "engineFamily" },
    { key: "dtc" },
    { key: "symptom" },
    { key: "component" },
    { key: "system" },
    { key: "year", type: "number" },
  ];

  return (
    <main className="mx-auto w-full max-w-7xl px-5 py-10">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">
          {t("eyebrow")}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          {t("title")}
        </h1>
        <p className="mt-2 max-w-3xl text-slate-600">{t("description")}</p>
      </header>

      <form
        action="/admin/retrieval"
        method="get"
        className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {fields.map((field) => (
            <label
              key={field.key}
              className="text-sm font-medium text-slate-700"
            >
              {t(`fields.${field.key}`)}
              <input
                type={field.type ?? "text"}
                name={field.key}
                min={field.type === "number" ? 0 : undefined}
                max={field.type === "number" ? 9999 : undefined}
                defaultValue={values[field.key]}
                placeholder={t(`placeholders.${field.key}`)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-950"
              />
            </label>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="submit"
            className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600"
          >
            {t("search")}
          </button>
          <Link
            href="/admin/retrieval"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            {t("clear")}
          </Link>
        </div>
      </form>

      {error ? (
        <p
          role="alert"
          className="mt-6 rounded-xl border border-red-300 bg-red-50 p-4 text-sm font-medium text-red-800"
        >
          {error}
        </p>
      ) : null}

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-slate-950">
          {hasSearch
            ? t("results", { count: results.length })
            : t("readyTitle")}
        </h2>

        {!hasSearch ? (
          <p className="mt-4 rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-600">
            {t("readyDescription")}
          </p>
        ) : error ? null : results.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-600">
            {t("empty")}
          </p>
        ) : (
          <ol className="mt-4 space-y-4">
            {results.map((result) => (
              <li
                key={result.caseId}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-900">
                        {t("score", { score: result.score })}
                      </span>
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                        {statusT(result.provenance.validationStatus)}
                      </span>
                      <span className="text-xs font-medium text-slate-500">
                        {result.provenance.reviewedByHuman
                          ? t("humanReviewed")
                          : t("automaticImport")}
                      </span>
                    </div>
                    <h3 className="mt-2 text-lg font-semibold text-slate-950">
                      {result.title}
                    </h3>
                    {result.summary ? (
                      <p className="mt-1 text-sm text-slate-600">
                        {result.summary}
                      </p>
                    ) : null}
                  </div>
                  <Link
                    href={`/admin/cases/${encodeURIComponent(result.caseId)}`}
                    className="shrink-0 text-sm font-semibold text-blue-700 hover:underline"
                  >
                    {t("openCase")}
                  </Link>
                </div>

                <dl className="mt-5 grid gap-4 text-sm md:grid-cols-2 xl:grid-cols-4">
                  <div>
                    <dt className="font-medium text-slate-500">
                      {t("reasons")}
                    </dt>
                    <dd className="mt-1">
                      <Values
                        empty={t("none")}
                        values={result.matchReasons.map((reason) =>
                          t(`matchReasons.${reason}`),
                        )}
                      />
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-500">{t("dtcs")}</dt>
                    <dd className="mt-1">
                      <Values
                        empty={t("none")}
                        values={result.matchingDtcs.map(
                          (item) => item.normalizedCode ?? item.rawCode,
                        )}
                      />
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-500">
                      {t("applicability")}
                    </dt>
                    <dd className="mt-1">
                      <Values
                        empty={t("none")}
                        values={result.matchingApplicability.map(
                          applicabilityLabel,
                        )}
                      />
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-500">
                      {t("matchedFacts")}
                    </dt>
                    <dd className="mt-1">
                      <Values
                        empty={t("none")}
                        values={[
                          ...result.matchingSymptoms.map((item) => item.label),
                          ...result.matchingComponents.map((item) => item.name),
                          ...(result.primarySystem &&
                          result.matchReasons.includes("system")
                            ? [result.primarySystem]
                            : []),
                        ]}
                      />
                    </dd>
                  </div>
                </dl>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}
