import assert from "node:assert/strict";
import test from "node:test";

import { runControlledQueue, type QueueDrainResult } from "./queue-runner";

test("pending jobs remain untouched when no database slot is available", async () => {
  const pending = ["waiting"];

  await runControlledQueue({
    concurrency: 2,
    async drainNext() {
      return { claimed: false };
    },
  });

  assert.deepEqual(pending, ["waiting"]);
});

test("queue runner respects concurrency and processes every pending job once", async () => {
  const pending = ["one", "two", "three", "four", "five"];
  const claimed = new Set<string>();
  let active = 0;
  let maximumActive = 0;

  await runControlledQueue({
    concurrency: 2,
    async drainNext(): Promise<QueueDrainResult> {
      const documentId = pending.shift();
      if (!documentId) return { claimed: false };
      assert.equal(claimed.has(documentId), false);
      claimed.add(documentId);
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await new Promise((resolve) => setTimeout(resolve, 2));
      active -= 1;
      return { claimed: true, documentId, status: "IMPORTED" };
    },
  });

  assert.equal(maximumActive, 2);
  assert.deepEqual([...claimed].sort(), [
    "five",
    "four",
    "one",
    "three",
    "two",
  ]);
});

test("a failed job does not stop later queued jobs", async () => {
  const results: QueueDrainResult[] = [
    { claimed: true, documentId: "failed", status: "FAILED" },
    { claimed: true, documentId: "next", status: "IMPORTED" },
    { claimed: false },
  ];
  const processed: string[] = [];

  await runControlledQueue({
    concurrency: 1,
    async drainNext() {
      return results.shift() ?? { claimed: false };
    },
    onResult(result) {
      processed.push(result.documentId!);
    },
  });

  assert.deepEqual(processed, ["failed", "next"]);
});

test("the queue runner stops when a drain request throws", async () => {
  let calls = 0;

  await assert.rejects(
    runControlledQueue({
      concurrency: 1,
      async drainNext() {
        calls += 1;
        throw new Error("database unavailable");
      },
    }),
    /database unavailable/,
  );

  assert.equal(calls, 1);
});
