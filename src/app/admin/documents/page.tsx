import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import {
  createDocumentDashboardItem,
  documentDashboardFilters,
  documentDashboardQuery,
  filterDocumentDashboardItems,
  inferDocumentFailureStage,
  normalizeDocumentDashboardFilter,
  sanitizeDocumentError,
  summarizeDocumentDashboard,
  type DocumentDashboardState,
} from "@/lib/documents/document-dashboard";
import { prisma } from "@/lib/server/prisma";

import { ExtractButton } from "./extract-button";
import { PdfUploadForm } from "./pdf-upload-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Metadata");
  return { title: t("documentsTitle") };
}

export const dynamic = "force-dynamic";

const statusClasses: Record<DocumentDashboardState, string> = {
  UPLOADED: "border-slate-300 bg-slate-100 text-slate-800",
  EXTRACTING: "border-amber-300 bg-amber-50 text-amber-900",
  IMPORTING: "border-indigo-300 bg-indigo-50 text-indigo-900",
  IMPORTED: "border-emerald-300 bg-emerald-50 text-emerald-900",
  FAILED: "border-red-300 bg-red-50 text-red-900",
};

function formatFileSize(bytes: number, locale: string) {
  const megabytes = bytes / (1024 * 1024);
  return `${new Intl.NumberFormat(locale, {
    maximumFractionDigits: megabytes >= 10 ? 0 : 1,
  }).format(megabytes)} MB`;
}

export default async function AdminDocumentsPage({
  searchParams,
}: PageProps<"/admin/documents">) {
  const [t, locale, query, sourceDocuments] = await Promise.all([
    getTranslations("Documents"),
    getLocale(),
    searchParams,
    prisma.sourceDocument.findMany(documentDashboardQuery),
  ]);
  const activeFilter = normalizeDocumentDashboardFilter(query.status);
  const documents = sourceDocuments.map(createDocumentDashboardItem);
  const filteredDocuments = filterDocumentDashboardItems(
    documents,
    activeFilter,
  );
  const summary = summarizeDocumentDashboard(documents);
  const dateFormatter = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const numberFormatter = new Intl.NumberFormat(locale);

  return (
    <main className="flex flex-1 justify-center px-5 py-12 sm:px-6">
      <div className="w-full max-w-6xl space-y-8">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">
            {t("eyebrow")}
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            {t("uploadTitle")}
          </h1>
          <p className="mt-3 max-w-3xl leading-7 text-slate-600">
            {t("uploadDescription")}
          </p>

          <PdfUploadForm />
        </section>

        <section className="space-y-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-slate-950">
                {t("title")}
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                {t("dashboardDescription")}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(["total", "processing", "imported", "failed"] as const).map(
                (key) => (
                  <div
                    key={key}
                    className="min-w-24 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm"
                  >
                    <p className="text-xs font-medium text-slate-500">
                      {t(`summary.${key}`)}
                    </p>
                    <p className="text-xl font-semibold text-slate-950">
                      {numberFormatter.format(summary[key])}
                    </p>
                  </div>
                ),
              )}
            </div>
          </div>

          <nav aria-label={t("filters.label")} className="flex flex-wrap gap-2">
            {documentDashboardFilters.map((filter) => {
              const active = filter === activeFilter;
              return (
                <Link
                  key={filter}
                  href={
                    filter === "all"
                      ? "/admin/documents"
                      : `/admin/documents?status=${filter}`
                  }
                  aria-current={active ? "page" : undefined}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                    active
                      ? "border-blue-700 bg-blue-700 text-white"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {t(`filters.${filter}`)}
                </Link>
              );
            })}
          </nav>

          {documents.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-600 shadow-sm">
              {t("empty")}
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-600 shadow-sm">
              {t("emptyFilter")}
            </div>
          ) : (
            <ul className="space-y-4">
              {filteredDocuments.map((document) => {
                const latestRun = document.latestRun;
                const hasTokenUsage = Boolean(
                  latestRun &&
                  (latestRun.inputTokens !== null ||
                    latestRun.outputTokens !== null ||
                    latestRun.totalTokens !== null),
                );
                const openKnowledgeHref =
                  document.technicalCases.length === 1
                    ? `/admin/cases/${encodeURIComponent(document.technicalCases[0].id)}`
                    : `#document-${document.id}-cases`;

                return (
                  <li
                    key={document.id}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClasses[document.state]}`}
                          >
                            {t(`status.${document.state}`)}
                          </span>
                          {document.manuallyReviewed ? (
                            <span className="rounded-full border border-violet-300 bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-900">
                              {t("manuallyReviewed")}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-3 break-words font-semibold text-slate-950">
                          {document.originalFilename}
                        </p>
                        {document.title ? (
                          <p className="mt-1 break-words text-sm text-slate-700">
                            {document.title}
                          </p>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                        <a
                          href={`/api/admin/documents/${encodeURIComponent(document.id)}/pdf`}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                        >
                          {t("openSourcePdf")}
                        </a>
                        {document.actions.includes("openKnowledge") ? (
                          <Link
                            href={openKnowledgeHref}
                            className="rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-600"
                          >
                            {t("openKnowledge")}
                          </Link>
                        ) : null}
                        {document.actions.includes("editKnowledge") ? (
                          <Link
                            href={`/admin/documents/${document.id}/review`}
                            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                          >
                            {t("editKnowledge")}
                          </Link>
                        ) : null}
                        {document.actions.includes("reviewImportIssues") ? (
                          <Link
                            href={`/admin/documents/${document.id}/review`}
                            className="rounded-lg border border-amber-400 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100"
                          >
                            {t("reviewFailedImport")}
                          </Link>
                        ) : null}
                        {document.actions.includes("extract") ||
                        document.actions.includes("reextract") ||
                        document.actions.includes("retry") ? (
                          <ExtractButton
                            documentId={document.id}
                            isRetry={document.actions.includes("retry")}
                            isReextract={document.actions.includes("reextract")}
                          />
                        ) : null}
                      </div>
                    </div>

                    <dl className="mt-5 grid gap-x-6 gap-y-3 border-t border-slate-100 pt-5 text-sm sm:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                          {t("fields.uploadedAt")}
                        </dt>
                        <dd className="mt-1 text-slate-800">
                          {dateFormatter.format(document.createdAt)}
                        </dd>
                      </div>
                      {document.bulletinReference ? (
                        <div>
                          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                            {t("fields.bulletinReference")}
                          </dt>
                          <dd className="mt-1 break-words text-slate-800">
                            {document.bulletinReference}
                          </dd>
                        </div>
                      ) : null}
                      {document.language ? (
                        <div>
                          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                            {t("fields.sourceLanguage")}
                          </dt>
                          <dd className="mt-1 text-slate-800">
                            {document.language}
                          </dd>
                        </div>
                      ) : null}
                      {latestRun?.originalFileSizeBytes !== null &&
                      latestRun?.originalFileSizeBytes !== undefined ? (
                        <div>
                          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                            {t("fields.originalSize")}
                          </dt>
                          <dd className="mt-1 text-slate-800">
                            {formatFileSize(
                              latestRun.originalFileSizeBytes,
                              locale,
                            )}
                          </dd>
                        </div>
                      ) : null}
                      {latestRun?.processingFileSizeBytes !== null &&
                      latestRun?.processingFileSizeBytes !== undefined ? (
                        <div>
                          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                            {t("fields.processingSize")}
                          </dt>
                          <dd className="mt-1 text-slate-800">
                            {formatFileSize(
                              latestRun.processingFileSizeBytes,
                              locale,
                            )}
                          </dd>
                        </div>
                      ) : null}
                      {latestRun?.processingWasOptimized !== null &&
                      latestRun?.processingWasOptimized !== undefined ? (
                        <div>
                          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                            {t("fields.optimization")}
                          </dt>
                          <dd className="mt-1 text-slate-800">
                            {latestRun.processingWasOptimized
                              ? t("optimization.optimized")
                              : latestRun.processingWarning
                                ? t("optimization.skipped")
                                : t("optimization.original")}
                          </dd>
                        </div>
                      ) : null}
                    </dl>

                    {latestRun ? (
                      <section className="mt-5 rounded-xl bg-slate-50 p-4">
                        <h3 className="text-sm font-semibold text-slate-900">
                          {t("latestExtraction")}
                        </h3>
                        <p className="mt-1 text-xs text-slate-500">
                          {dateFormatter.format(latestRun.startedAt)}
                        </p>
                        <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-3 text-sm">
                          {latestRun.model ? (
                            <div>
                              <dt className="text-xs text-slate-500">
                                {t("fields.model")}
                              </dt>
                              <dd className="font-medium text-slate-800">
                                {latestRun.model}
                              </dd>
                            </div>
                          ) : null}
                          {hasTokenUsage ? (
                            <>
                              {latestRun.inputTokens !== null ? (
                                <div>
                                  <dt className="text-xs text-slate-500">
                                    {t("fields.inputTokens")}
                                  </dt>
                                  <dd className="font-medium text-slate-800">
                                    {numberFormatter.format(
                                      latestRun.inputTokens,
                                    )}
                                  </dd>
                                </div>
                              ) : null}
                              {latestRun.outputTokens !== null ? (
                                <div>
                                  <dt className="text-xs text-slate-500">
                                    {t("fields.outputTokens")}
                                  </dt>
                                  <dd className="font-medium text-slate-800">
                                    {numberFormatter.format(
                                      latestRun.outputTokens,
                                    )}
                                  </dd>
                                </div>
                              ) : null}
                              {latestRun.totalTokens !== null ? (
                                <div>
                                  <dt className="text-xs text-slate-500">
                                    {t("fields.totalTokens")}
                                  </dt>
                                  <dd className="font-medium text-slate-800">
                                    {numberFormatter.format(
                                      latestRun.totalTokens,
                                    )}
                                  </dd>
                                </div>
                              ) : null}
                            </>
                          ) : null}
                        </dl>
                        {latestRun.processingWarning ? (
                          <details className="mt-3 text-sm text-amber-900">
                            <summary className="cursor-pointer font-medium">
                              {t("optimization.note")}
                            </summary>
                            <p className="mt-2 break-words whitespace-pre-wrap">
                              {sanitizeDocumentError(
                                latestRun.processingWarning,
                              )}
                            </p>
                          </details>
                        ) : null}
                      </section>
                    ) : null}

                    {document.state === "FAILED" ? (
                      <section className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-red-900">
                        <h3 className="text-sm font-semibold">
                          {latestRun
                            ? t(
                                `errors.${inferDocumentFailureStage(latestRun)}`,
                              )
                            : t("errors.extraction")}
                        </h3>
                        <p className="mt-1 text-sm">{t("failedHelp")}</p>
                        {latestRun?.errorMessage ? (
                          <details className="mt-3 text-sm">
                            <summary className="cursor-pointer font-medium">
                              {t("technicalDetails")}
                            </summary>
                            <p className="mt-2 break-words whitespace-pre-wrap font-mono text-xs">
                              {sanitizeDocumentError(latestRun.errorMessage)}
                            </p>
                          </details>
                        ) : null}
                      </section>
                    ) : null}

                    {document.technicalCases.length > 0 ? (
                      <section
                        id={`document-${document.id}-cases`}
                        className="mt-5 border-t border-slate-100 pt-5"
                      >
                        <h3 className="text-sm font-semibold text-slate-900">
                          {t("technicalCases", {
                            count: document.technicalCases.length,
                          })}
                        </h3>
                        <ul className="mt-2 flex flex-wrap gap-2">
                          {document.technicalCases.map((technicalCase) => (
                            <li key={technicalCase.id}>
                              <Link
                                href={`/admin/cases/${encodeURIComponent(technicalCase.id)}`}
                                className="inline-flex rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-800 hover:bg-blue-100"
                              >
                                {technicalCase.title}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </section>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
