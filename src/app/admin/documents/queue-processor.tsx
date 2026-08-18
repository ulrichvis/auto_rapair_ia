"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import {
  runControlledQueue,
  type QueueDrainResult,
} from "@/lib/extraction/queue-runner";

export function QueueProcessor({
  concurrency,
  hasQueuedDocuments,
  hasProcessingDocuments,
}: {
  concurrency: number;
  hasQueuedDocuments: boolean;
  hasProcessingDocuments: boolean;
}) {
  const t = useTranslations("Queue");
  const router = useRouter();
  const running = useRef(false);
  const failureLatched = useRef(false);
  const [processed, setProcessed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    if (!hasQueuedDocuments) {
      failureLatched.current = false;
    }

    if (hasQueuedDocuments && !running.current && !failureLatched.current) {
      let cancelled = false;
      let processedThisCycle = 0;
      running.current = true;
      setProcessed(0);
      setError(null);

      void runControlledQueue({
        concurrency,
        async drainNext(): Promise<QueueDrainResult> {
          if (cancelled) return { claimed: false };

          const response = await fetch("/api/admin/ingestion/drain", {
            method: "POST",
          });
          const result = (await response.json()) as QueueDrainResult & {
            error?: string;
          };

          if (!response.ok) {
            throw new Error(result.error ?? t("failed"));
          }

          return result;
        },
        onResult() {
          processedThisCycle += 1;
          if (!cancelled) setProcessed((count) => count + 1);
        },
      })
        .catch((reason) => {
          failureLatched.current = true;

          if (!cancelled) {
            setError(reason instanceof Error ? reason.message : t("failed"));
          }
        })
        .finally(() => {
          running.current = false;
          if (!cancelled) {
            router.refresh();

            if (!failureLatched.current) {
              window.setTimeout(
                () => {
                  if (!cancelled && hasQueuedDocuments) {
                    setCycle((value) => value + 1);
                  }
                },
                processedThisCycle > 0 ? 1_000 : 5_000,
              );
            }
          }
        });

      return () => {
        cancelled = true;
      };
    }

    if (hasProcessingDocuments) {
      const refreshTimer = window.setTimeout(() => router.refresh(), 5_000);
      return () => window.clearTimeout(refreshTimer);
    }
  }, [
    concurrency,
    cycle,
    hasProcessingDocuments,
    hasQueuedDocuments,
    router,
    t,
  ]);

  if (!hasQueuedDocuments && !hasProcessingDocuments && !error) return null;

  return (
    <div
      role={error ? "alert" : "status"}
      className={`rounded-xl border px-4 py-3 text-sm ${
        error
          ? "border-red-300 bg-red-50 text-red-800"
          : "border-blue-200 bg-blue-50 text-blue-800"
      }`}
    >
      {error
        ? error
        : processed > 0
          ? t("processed", { count: processed })
          : t("processing")}
    </div>
  );
}
