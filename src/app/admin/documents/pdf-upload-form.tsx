"use client";

import { FormEvent, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { MAX_PDF_SIZE_BYTES } from "@/lib/documents/pdf-validation";

type UploadResponse = {
  status?: "created" | "duplicate";
  originalFilename?: string;
  error?: string;
};

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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!selectedFile) {
      setError(t("selectOne"));
      return;
    }

    if (
      selectedFile.type !== "application/pdf" ||
      !selectedFile.name.toLowerCase().endsWith(".pdf")
    ) {
      setError(t("selectPdf"));
      return;
    }

    if (selectedFile.size > MAX_PDF_SIZE_BYTES) {
      setError(t("tooLarge"));
      return;
    }

    const formData = new FormData();
    formData.set("file", selectedFile);
    setIsUploading(true);

    try {
      const response = await fetch("/api/admin/documents", {
        method: "POST",
        body: formData,
      });
      const result = (await response.json()) as UploadResponse;

      if (!response.ok) {
        throw new Error(result.error ?? t("failed"));
      }

      setSuccess(
        result.status === "duplicate"
          ? t("duplicate", { filename: result.originalFilename ?? "" })
          : t("success", { filename: result.originalFilename ?? "" }),
      );
      setSelectedFile(null);
      formRef.current?.reset();
      router.refresh();
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
          disabled={isUploading}
          onChange={(event) => {
            setSelectedFile(event.target.files?.[0] ?? null);
            setError(null);
            setSuccess(null);
          }}
          className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 file:mr-4 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:font-medium file:text-slate-900 hover:file:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
        />
        <p className="mt-2 text-sm text-slate-500">{t("help")}</p>
      </div>

      {selectedFile ? (
        <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <p className="font-medium text-slate-900">{selectedFile.name}</p>
          <p className="mt-1">
            {formatFileSize(selectedFile.size, locale)} MiB
          </p>
        </div>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </p>
      ) : null}

      {success ? (
        <p
          role="status"
          className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700"
        >
          {success}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={!selectedFile || isUploading}
        className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isUploading ? t("uploading") : t("upload")}
      </button>
    </form>
  );
}
