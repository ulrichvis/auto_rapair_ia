import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import {
  normalizeCaseBrowserFilters,
  technicalCaseListQuery,
  validationStatuses,
  type CaseBrowserFilters,
} from "@/lib/knowledge/case-browser";
import { prisma } from "@/lib/server/prisma";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Metadata");
  return { title: t("casesTitle") };
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function unique(values: Array<string | null>) {
  return [
    ...new Set(values.filter((value): value is string => Boolean(value))),
  ];
}

function SummaryValues({ values }: { values: string[] }) {
  if (values.length === 0) return <span>—</span>;

  return (
    <span className="flex flex-wrap gap-1.5">
      {values.slice(0, 4).map((value) => (
        <span
          key={value}
          className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
        >
          {value}
        </span>
      ))}
      {values.length > 4 ? <span>+{values.length - 4}</span> : null}
    </span>
  );
}

export default async function AdminCasesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const filters = normalizeCaseBrowserFilters({
    q: first(query.q),
    status: first(query.status),
    brand: first(query.brand),
    model: first(query.model),
    engineCode: first(query.engineCode),
    engineFamily: first(query.engineFamily),
    dtc: first(query.dtc),
    symptom: first(query.symptom),
    component: first(query.component),
    system: first(query.system),
  });
  const [t, locale, cases] = await Promise.all([
    getTranslations("CaseBrowser"),
    getLocale(),
    prisma.technicalCase.findMany(technicalCaseListQuery(filters)),
  ]);
  const fields: Array<{
    key: keyof CaseBrowserFilters;
    label: string;
    placeholder: string;
  }> = [
    {
      key: "q",
      label: t("filters.title"),
      placeholder: t("placeholders.title"),
    },
    {
      key: "brand",
      label: t("filters.brand"),
      placeholder: t("placeholders.brand"),
    },
    {
      key: "model",
      label: t("filters.model"),
      placeholder: t("placeholders.model"),
    },
    {
      key: "engineCode",
      label: t("filters.engineCode"),
      placeholder: t("placeholders.engineCode"),
    },
    {
      key: "engineFamily",
      label: t("filters.engineFamily"),
      placeholder: t("placeholders.engineFamily"),
    },
    { key: "dtc", label: t("filters.dtc"), placeholder: t("placeholders.dtc") },
    {
      key: "symptom",
      label: t("filters.symptom"),
      placeholder: t("placeholders.symptom"),
    },
    {
      key: "component",
      label: t("filters.component"),
      placeholder: t("placeholders.component"),
    },
    {
      key: "system",
      label: t("filters.system"),
      placeholder: t("placeholders.system"),
    },
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
        action="/admin/cases"
        method="get"
        className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {fields.map((field) => (
            <label
              key={field.key}
              className="text-sm font-medium text-slate-700"
            >
              {field.label}
              <input
                name={field.key}
                defaultValue={filters[field.key]}
                placeholder={field.placeholder}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-950"
              />
            </label>
          ))}
          <label className="text-sm font-medium text-slate-700">
            {t("filters.status")}
            <select
              name="status"
              defaultValue={filters.status ?? ""}
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950"
            >
              <option value="">{t("allStatuses")}</option>
              {validationStatuses.map((status) => (
                <option key={status} value={status}>
                  {t(`status.${status}`)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="submit"
            className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600"
          >
            {t("search")}
          </button>
          <Link
            href="/admin/cases"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            {t("clear")}
          </Link>
        </div>
      </form>

      <section className="mt-8">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-slate-950">
            {t("results", { count: cases.length })}
          </h2>
        </div>

        {cases.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-600">
            {t("empty")}
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {cases.map((technicalCase) => {
              const dtcs = unique(
                technicalCase.faultCodes.map(
                  (faultCode) => faultCode.normalizedCode ?? faultCode.rawCode,
                ),
              );
              const vehicles = unique(
                technicalCase.applicability.map((item) =>
                  [item.brand, item.model].filter(Boolean).join(" "),
                ),
              );
              const engines = unique(
                technicalCase.applicability.map((item) =>
                  [item.engineCode, item.engineFamily]
                    .filter(Boolean)
                    .join(" / "),
                ),
              );

              return (
                <li
                  key={technicalCase.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                          {t(`status.${technicalCase.validationStatus}`)}
                        </span>
                        {technicalCase.primarySystem ? (
                          <span className="text-sm text-slate-500">
                            {technicalCase.primarySystem}
                          </span>
                        ) : null}
                      </div>
                      <h3 className="mt-2 text-lg font-semibold text-slate-950">
                        <Link
                          href={`/admin/cases/${technicalCase.id}`}
                          className="hover:text-blue-700 hover:underline"
                        >
                          {technicalCase.title}
                        </Link>
                      </h3>
                    </div>
                    <p className="shrink-0 text-xs text-slate-500">
                      {t("updated", {
                        date: new Intl.DateTimeFormat(locale, {
                          dateStyle: "medium",
                        }).format(technicalCase.updatedAt),
                      })}
                    </p>
                  </div>
                  <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                    <div>
                      <dt className="font-medium text-slate-500">
                        {t("dtcs")}
                      </dt>
                      <dd className="mt-1">
                        <SummaryValues values={dtcs} />
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium text-slate-500">
                        {t("vehicles")}
                      </dt>
                      <dd className="mt-1">
                        <SummaryValues values={vehicles} />
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium text-slate-500">
                        {t("engines")}
                      </dt>
                      <dd className="mt-1">
                        <SummaryValues values={engines} />
                      </dd>
                    </div>
                  </dl>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
