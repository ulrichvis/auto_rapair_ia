import type { Metadata } from "next";

import { prisma } from "@/lib/server/prisma";

import { ExtractButton } from "./extract-button";
import { PdfUploadForm } from "./pdf-upload-form";

export const metadata: Metadata = {
  title: "Documents | AutoRepair Knowledge",
};

export const dynamic = "force-dynamic";

const statusLabels = {
  PENDING: "Ready to extract",
  PROCESSING: "Processing",
  REVIEW_REQUIRED: "Extraction completed · Review required",
  COMPLETED: "Completed",
  FAILED: "Extraction failed",
} as const;

export default async function AdminDocumentsPage() {
  const documents = await prisma.sourceDocument.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      originalFilename: true,
      processingStatus: true,
      createdAt: true,
      ingestionRuns: {
        orderBy: { startedAt: "desc" },
        take: 1,
        select: { errorMessage: true },
      },
    },
  });

  return (
    <main className="flex flex-1 justify-center px-6 py-16">
      <div className="w-full max-w-4xl space-y-8">
        <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">
            Admin
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            Upload a technical PDF
          </h1>
          <p className="mt-3 leading-7 text-slate-600">
            Add one source document to the private technical knowledge library.
            Uploaded PDFs remain private. Extraction creates a draft for human
            review and does not write validated technical knowledge.
          </p>

          <PdfUploadForm />
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-950">Documents</h2>

          {documents.length === 0 ? (
            <p className="mt-4 text-sm text-slate-600">
              No documents uploaded yet.
            </p>
          ) : (
            <ul className="mt-5 divide-y divide-slate-200">
              {documents.map((document) => {
                const canExtract =
                  document.processingStatus === "PENDING" ||
                  document.processingStatus === "FAILED";
                const latestError = document.ingestionRuns[0]?.errorMessage;

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
                        {statusLabels[document.processingStatus]}
                      </p>
                      {document.processingStatus === "FAILED" && latestError ? (
                        <p className="mt-2 text-sm text-red-700">
                          {latestError}
                        </p>
                      ) : null}
                    </div>

                    {canExtract ? (
                      <ExtractButton
                        documentId={document.id}
                        isRetry={document.processingStatus === "FAILED"}
                      />
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
