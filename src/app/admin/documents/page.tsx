import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/server/prisma";

import { ExtractButton } from "./extract-button";
import { PdfUploadForm } from "./pdf-upload-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Metadata");
  return { title: t("documentsTitle") };
}

export const dynamic = "force-dynamic";

export default async function AdminDocumentsPage() {
  const t = await getTranslations("Documents");
  const documents = await prisma.sourceDocument.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      originalFilename: true,
      processingStatus: true,
      createdAt: true,
      ingestionRuns: {
        where: {
          status: { in: ["SUCCESS", "IMPORTED", "FAILED"] },
          rawOutput: { not: Prisma.AnyNull },
        },
        orderBy: { startedAt: "desc" },
        take: 1,
        select: { rawOutput: true, importedAt: true },
      },
    },
  });

  return (
    <main className="flex flex-1 justify-center px-6 py-16">
      <div className="w-full max-w-4xl space-y-8">
        <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">
            {t("eyebrow")}
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            {t("uploadTitle")}
          </h1>
          <p className="mt-3 leading-7 text-slate-600">
            {t("uploadDescription")}
          </p>

          <PdfUploadForm />
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-950">{t("title")}</h2>

          {documents.length === 0 ? (
            <p className="mt-4 text-sm text-slate-600">{t("empty")}</p>
          ) : (
            <ul className="mt-5 divide-y divide-slate-200">
              {documents.map((document) => {
                const canExtract =
                  document.processingStatus === "PENDING" ||
                  document.processingStatus === "FAILED" ||
                  document.processingStatus === "REVIEW_REQUIRED";
                const latestRun = document.ingestionRuns[0];
                const canReview = Boolean(latestRun?.rawOutput);
                return (
                  <li
                    key={document.id}
                    className="flex flex-col gap-4 py-5 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-950">
                        {document.originalFilename}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {t(`status.${document.processingStatus}`)}
                      </p>
                      {document.processingStatus === "FAILED" ? (
                        <p className="mt-2 text-sm text-red-700">
                          {t("failedHelp")}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      {document.processingStatus === "COMPLETED" ? (
                        <Link
                          href="/admin/cases"
                          className="rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-600"
                        >
                          {t("openKnowledge")}
                        </Link>
                      ) : null}
                      {canReview ? (
                        <Link
                          href={`/admin/documents/${document.id}/review`}
                          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                        >
                          {latestRun?.importedAt
                            ? t("editKnowledge")
                            : t("reviewFailedImport")}
                        </Link>
                      ) : null}
                      {canExtract ? (
                        <ExtractButton
                          documentId={document.id}
                          isRetry={document.processingStatus === "FAILED"}
                          isReextract={
                            document.processingStatus === "REVIEW_REQUIRED"
                          }
                        />
                      ) : null}
                    </div>
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
