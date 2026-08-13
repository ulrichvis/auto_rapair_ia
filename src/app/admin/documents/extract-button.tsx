"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type ExtractButtonProps = {
  documentId: string;
  isRetry: boolean;
  isReextract?: boolean;
};

export function ExtractButton({
  documentId,
  isRetry,
  isReextract = false,
}: ExtractButtonProps) {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExtract() {
    setIsProcessing(true);
    setError(null);
    router.refresh();

    try {
      const response = await fetch(
        `/api/admin/documents/${encodeURIComponent(documentId)}/extract`,
        { method: "POST" },
      );
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(result.error ?? "Extraction failed.");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Extraction failed.");
    } finally {
      setIsProcessing(false);
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={handleExtract}
        disabled={isProcessing}
        className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isProcessing
          ? "Processing…"
          : isRetry
            ? "Retry extraction"
            : isReextract
              ? "Re-extract"
              : "Extract"}
      </button>
      {error ? (
        <p role="alert" className="max-w-52 text-right text-xs text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
