export type QueueDrainResult = {
  claimed: boolean;
  documentId?: string;
  status?: "IMPORTED" | "FAILED";
};

export async function runControlledQueue({
  concurrency,
  drainNext,
  onResult,
}: {
  concurrency: number;
  drainNext(): Promise<QueueDrainResult>;
  onResult?(result: QueueDrainResult): void;
}) {
  async function worker() {
    while (true) {
      const result = await drainNext();

      if (!result.claimed) return;
      onResult?.(result);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
}
