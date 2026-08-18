"use client";

import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import type { PdfValidationErrorCode } from "@/lib/documents/pdf-validation";
import {
  createPdfBatch,
  summarizePdfBatch,
  uploadPdfBatch,
  type PdfBatchItem,
  type PdfBatchUploadResponse,
} from "@/lib/documents/pdf-upload-batch";

type UploadResponse = {
  status?: "created" | "duplicate";
  originalFilename?: string;
  code?: PdfValidationErrorCode | "FILE_REQUIRED";
  error?: string;
};

const validationCodes: ReadonlyArray<PdfValidationErrorCode | "FILE_REQUIRED"> =
  [
    "FILE_REQUIRED",
    "INVALID_FILENAME",
    "NOT_PDF",
    "EMPTY",
    "TOO_LARGE",
    "INVALID_PDF",
  ];

function formatFileSize(bytes: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 2,
  }).format(bytes / 1024 / 1024);
}

export function PdfUploadForm() {
  const t = useTranslations("Upload");
  const locale = useLocale();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [items, setItems] = useState<PdfBatchItem<File>[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadComplete, setUploadComplete] = useState(false);
  const summary = summarizePdfBatch(items);
  const hasReadyFiles = items.some((item) => item.state === "ready");

  function validationMessage(code: PdfValidationErrorCode | undefined) {
    if (code === "TOO_LARGE") return t("tooLarge");
    if (code === "EMPTY") return t("empty");
    if (code === "INVALID_FILENAME") return t("invalidFilename");
    if (code === "INVALID_PDF") return t("invalidPdf");
    return t("selectPdf");
  }

  async function uploadOne(file: File): Promise<PdfBatchUploadResponse> {
    const formData = new FormData();
    formData.set("file", file);
    const response = await fetch("/api/admin/documents", {
      method: "POST",
      body: formData,
    });
    const result = (await response.json()) as UploadResponse;

    if (!response.ok) {
      if (
        result.code &&
        validationCodes.includes(result.code) &&
        result.code !== "FILE_REQUIRED"
      ) {
        return { status: "invalid", error: result.error };
      }
      throw new Error(result.error ?? t("failed"));
    }

    return {
      status: result.status === "duplicate" ? "duplicate" : "uploaded",
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setUploadComplete(false);

    if (!hasReadyFiles) {
      setError(items.length === 0 ? t("selectOne") : t("noValidFiles"));
      return;
    }

    setIsUploading(true);

    try {
      const result = await uploadPdfBatch(items, uploadOne, setItems);
      const resultSummary = summarizePdfBatch(result);
      setUploadComplete(true);
      formRef.current?.reset();
      if (resultSummary.uploaded > 0) router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("failed"));
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="mt-8 space-y-5">
      <div>
        <label
          htmlFor="pdf"
          className="block text-sm font-medium text-slate-900"
        >
          {t("documentLabel")}
        </label>
        <input
          id="pdf"
          name="file"
          type="file"
          accept="application/pdf,.pdf"
          multiple
          disabled={isUploading}
          onChange={(event) => {
            setItems(createPdfBatch(Array.from(event.target.files ?? [])));
            setError(null);
            setUploadComplete(false);
          }}
          className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 file:mr-4 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:font-medium file:text-slate-900 hover:file:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
        />
        <p className="mt-2 text-sm text-slate-500">{t("help")}</p>
      </div>

      {items.length > 0 ? (
        <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h2 className="text-sm font-semibold text-slate-900">
            {t("filesSelected", { count: summary.selected })}
          </h2>
          <ul className="mt-3 space-y-2">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-2 rounded-lg bg-white px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">
                    {item.file.name}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {formatFileSize(item.file.size, locale)} MiB
                  </p>
                  {item.state === "invalid" ? (
                    <p className="mt-1 text-xs text-red-700">
                      {item.error ?? validationMessage(item.validationCode)}
                    </p>
                  ) : item.state === "failed" && item.error ? (
                    <p className="mt-1 text-xs text-red-700">{item.error}</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-semibold ${
                      item.state === "uploaded"
                        ? "bg-emerald-100 text-emerald-800"
                        : item.state === "duplicate"
                          ? "bg-amber-100 text-amber-900"
                          : item.state === "invalid" || item.state === "failed"
                            ? "bg-red-100 text-red-800"
                            : item.state === "uploading"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {t(`batchStatus.${item.state}`)}
                  </span>
                  {(item.state === "ready" || item.state === "invalid") &&
                  !isUploading ? (
                    <button
                      type="button"
                      onClick={() =>
                        setItems((current) =>
                          current.filter(
                            (currentItem) => currentItem.id !== item.id,
                          ),
                        )
                      }
                      className="text-xs font-semibold text-red-700 hover:text-red-900"
                    >
                      {t("remove")}
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {isUploading ? (
        <p role="status" className="text-sm font-medium text-blue-800">
          {t("progress", {
            uploaded: summary.uploaded,
            total: summary.selected,
          })}
        </p>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </p>
      ) : null}

      {uploadComplete ? (
        <div
          role="status"
          className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800"
        >
          <p className="font-semibold">{t("uploadComplete")}</p>
          <p className="mt-1">
            {t("completeSummary", {
              uploaded: summary.uploaded,
              duplicate: summary.duplicate,
              invalid: summary.invalid,
              failed: summary.failed,
            })}
          </p>
        </div>
      ) : null}

      <button
        type="submit"
        disabled={!hasReadyFiles || isUploading}
        className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isUploading ? t("uploading") : t("uploadFiles")}
      </button>
    </form>
  );
}
